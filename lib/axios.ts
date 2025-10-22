import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

export const api = axios.create({
  // baseURL: "http://172.16.6.91:2009",
  baseURL: "http://172.16.5.10:2004",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
  },
});
export const db = axios.create({
  // baseURL: "http://172.16.6.91:2009",
  baseURL: "http://localhost:8080/",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true, // Gửi cookies để server xóa
});

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error?: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

// ---- Axios interceptor ----
db.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 1️⃣ Không có response (VD: server chết, CORS lỗi, mạng rớt)
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    // 2️⃣ Nếu 401 mà chưa retry và không phải endpoint /agent/auth/me
    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/agent/auth/me")
    ) {
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
        // 3️⃣ Gọi API refresh token
        await db.get("/agent/auth/me");

        // 4️⃣ Refresh thành công → retry lại các request đang chờ
        processQueue(null);
        return db(originalRequest);
      } catch (err: any) {
        processQueue(err);

        // 5️⃣ Nếu /agent/auth/me cũng 401 → refreshToken cũng hết hạn
        if (err?.response?.status === 401) {
          console.warn("Refresh token expired → redirecting to login...");
          window.location.href = "/login"; // hoặc navigate("/login")
        }

        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // 6️⃣ Nếu chính /agent/auth/me bị 401 → không làm gì thêm (tránh loop)
    if (status === 401 && originalRequest.url?.includes("/agent/auth/me")) {
      console.warn("Auth endpoint 401 - forcing logout...");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);