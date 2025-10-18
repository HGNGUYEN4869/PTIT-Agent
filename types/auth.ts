export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  username: string | null;
  loading: boolean;
}