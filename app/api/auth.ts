import { db } from "@/lib/axios";
import { AuthResponse, CheckAccountRequest, CheckAccountResponse, CheckAuthResponse, LoginRequest, RegisterRequest, RegisterResponse } from "@/types/auth";
import { toast } from "sonner";

// API Functions

/**
 * Đăng ký user mới
 */
export const register = async (
  data: RegisterRequest
): Promise<RegisterResponse> => {
  const response = await db.post<RegisterResponse>(
    "/agent/auth/register",
    data,
    {
      withCredentials: true, // Quan trọng: Gửi và nhận cookies
    }
  );
  return response.data;
};
/**
 * Check tài khoản tồn tại
 */
export const checkAccount = async (
  data: CheckAccountRequest
): Promise<CheckAccountResponse> => {
  const response = await db.post<CheckAccountResponse>(
    "/agent/auth/checkAccount",
    data,
    {
      withCredentials: true, // Quan trọng: Gửi và nhận cookies
    }
  );
  return response.data;
};

/**
 * Đăng nhập
 * HttpOnly cookies (accessToken, refreshToken) sẽ được tự động lưu bởi browser
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await db.post<AuthResponse>("/agent/auth/login", data, {
    withCredentials: true, // Quan trọng: Gửi và nhận cookies
  });
  return response.data;
};

/**
 * Đăng xuất
 * Xóa cookies (accessToken, refreshToken)
 */
export const logout = async (
  email: string
): Promise<{ message: string }> => {
  const response = await db.post<{ message: string }>(
    "/agent/auth/logout",
    { email },
    {
      withCredentials: true, // Gửi cookies để server xóa
    }
  );
  return response.data;
};

/**
 * Kiểm tra trạng thái đăng nhập
 * Gọi API có yêu cầu authentication để verify cookie còn hợp lệ
 */
export const checkAuth = async (): Promise<CheckAuthResponse> => {
  try {
    // Gọi API protected để verify token
    // Backend cần có endpoint GET /me (lấy thông tin user hiện tại)
    const response = await db.get("/agent/auth/me", {
      withCredentials: true,
    });

    if (response.status !== 200) {
      toast.error(`Lỗi ${response.status}: Xác thực thất bại`);
      return {
        isAuthenticated: false,
      };
    }
    // Nếu API trả về thành công, user đã đăng nhập
    // Giả sử backend trả về userId và username trong response
    return {
      isAuthenticated: true,
      userId: response.data.userId,
      username: response.data.username,
      email: response.data.email,
      stuId: response.data.stuId,
      citizenId: response.data.citizenId,
    };
  } catch (error) {
    // Nếu lỗi (401, 403), user chưa đăng nhập hoặc token hết hạn
    return {
      isAuthenticated: false,
    };
  }
};
