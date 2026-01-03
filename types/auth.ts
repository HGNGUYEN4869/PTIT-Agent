export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  username: string | null;
  stuId: string | null;
  citizenId: string | null;
  loading: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  stuId: string;
  citizenId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  userId: string;
  email: string;
  stuId: string;
  citizenId: string;
  username: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  username: string;
  stuId: string;
  citizenId: string;
  email: string;
}

export interface CheckAuthResponse {
  isAuthenticated: boolean;
  userId?: string;
  username?: string;
  stuId?: string;
  citizenId?: string;
  email?: string;
}

export interface CheckAccountRequest {
  stuId?: string;
  citizenId?: string;
}

export interface CheckAccountResponse {
  username: string;
  email: string;
}