"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { setAuth, clearAuth, setLoading } from "@/store/authSlice";
import { checkAuth } from "@/app/api/auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard - HOC để protect các route cần authentication
 *
 * Cách dùng:
 * <AuthGuard>
 *   <YourProtectedContent />
 * </AuthGuard>
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    const verifyAuth = async () => {
      dispatch(setLoading(true));

      try {
        const result = await checkAuth();

        if (
          result.userId &&
          result.username &&
          result.email
        ) {
          // User đã đăng nhập, lưu vào Redux
          dispatch(
            setAuth({
              userId: result.userId,
              email: result.email,
              username: result.username,
              stuId: result.stuId || "",
              citizenId: result.citizenId || "",
            })
          );
        } else {
          // User chưa đăng nhập, redirect về login
          dispatch(clearAuth());
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        dispatch(clearAuth());
        router.push("/login");
      }
    };

    // Chỉ check auth nếu chưa authenticated
    if (!isAuthenticated) {
      verifyAuth();
    }
  }, [dispatch, router, isAuthenticated]);

  // Hiển thị loading khi đang check auth
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang xác thực</p>
        </div>
      </div>
    );
  }

  // Nếu chưa authenticated, không render gì (đang redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Đã authenticated, render children
  return <>{children}</>;
}
