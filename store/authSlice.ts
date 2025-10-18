import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthState } from "../types/auth";

const initialState: AuthState = {
  isAuthenticated: false,
  userId: null,
  username: null,
  email: null,
  loading: true, // Bắt đầu là true để check auth lần đầu
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{ userId: string; email: string; username: string }>
    ) {
      state.isAuthenticated = true;
      state.userId = action.payload.userId;
      state.email = action.payload.email;
      state.username = action.payload.username;
      state.loading = false;
    },
    clearAuth(state) {
      state.isAuthenticated = false;
      state.userId = null;
      state.username = null;
      state.email = null;
      state.loading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setAuth, clearAuth, setLoading } = authSlice.actions;
export default authSlice.reducer;
