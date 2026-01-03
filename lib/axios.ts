/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from "axios";

export const ragApi = axios.create({
  // baseURL: "http://172.16.6.91:2009",
  baseURL: "http://172.16.5.10:2004",
  // baseURL: "http://localhost:8000",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
  },
});
export const stuCardApi = axios.create({
  baseURL: "http://172.16.5.10:3333",
  headers: {
    accept: "application/json",
    "Content-Type": "multipart/form-data",
  },
});
export const db = axios.create({
  // baseURL: "http://172.16.6.91:2009",
  // baseURL: "http://localhost:2005",
  baseURL: "https://ptit-agent-be-production.up.railway.app",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true, // Gửi cookies để server xóa
});

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

// ---- Axios interceptor ----
db.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Không có response (VD: server chết, CORS lỗi, mạng rớt)
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    //  Thêm điều kiện: Không refresh cho login/register endpoints
    const isAuthEndpoint =
      originalRequest.url.includes("/agent/auth/login") ||
      originalRequest.url.includes("/agent/auth/register") ||
      originalRequest.url.includes("/agent/auth/me");

    // Nếu 401 mà chưa retry và không phải endpoint /agent/auth/me
    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Nếu đang refresh, thêm request vào hàng đợi
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(db(originalRequest)),
            reject: (err) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API refresh token
        await db.get("/agent/auth/me");

        // Refresh thành công → retry lại các request đang chờ
        processQueue(null);
        return db(originalRequest);
      } catch (err: any) {
        processQueue(err);

        //Nếu /agent/auth/me cũng 401 → refreshToken cũng hết hạn
        if (err?.response?.status === 401) {
          console.warn("Refresh token expired → redirecting to login...");
          window.location.href = "/login"; // hoặc navigate("/login")
        }

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    //Nếu chính /agent/auth/me bị 401 → không làm gì thêm (tránh loop)
    if (status === 401 && originalRequest.url.includes("/agent/auth/me")) {
      console.warn("Auth endpoint 401 - forcing logout...");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);
