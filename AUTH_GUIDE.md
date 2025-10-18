# 🔐 Authentication Guide - Chatbot RAG Frontend

## 📋 Tổng quan

Dự án sử dụng **JWT Authentication với HttpOnly Cookies** và **AuthGuard HOC** để bảo vệ routes.

---

## 🏗️ Kiến trúc

### 1. **Redux Store** - Quản lý Auth State

```typescript
// store/authSlice.ts
interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  loading: boolean;
}
```

**Actions:**

- `setAuth({ userId, username })` - Lưu thông tin user sau khi đăng nhập
- `clearAuth()` - Xóa thông tin user khi logout
- `setLoading(boolean)` - Set trạng thái loading

---

### 2. **API Functions** - Call Backend

```typescript
// app/api/auth.ts

// Đăng ký
await register({ userName: "test", password: "123456" });

// Đăng nhập
await login({ username: "test", password: "123456" });

// Kiểm tra auth
const result = await checkAuth();
// → { isAuthenticated: true, userId: "...", username: "..." }

// Refresh token
await refreshToken();

// Đăng xuất
await logout("test");
```

**Backend Endpoints:**

- `POST /agent/auth/register` - Đăng ký
- `POST /agent/auth/login` - Đăng nhập (set HttpOnly cookies)
- `POST /agent/auth/refresh` - Làm mới access token
- `POST /agent/auth/logout` - Xóa cookies
- `GET /api/chats/user` - Verify token (dùng trong `checkAuth()`)

---

### 3. **AuthGuard Component** - Protect Routes

```typescript
// components/component/AuthGuard.tsx
<AuthGuard>
  <YourProtectedContent />
</AuthGuard>
```

**Cách hoạt động:**

1. ✅ Check auth bằng `checkAuth()` API
2. ✅ Nếu authenticated → Lưu user info vào Redux → Render children
3. ❌ Nếu chưa authenticated → Redirect về `/` (home)
4. ⏳ Đang check → Hiển thị loading spinner

---

## 🎯 Cách sử dụng

### **Bước 1: Wrap protected page với AuthGuard**

```typescript
// app/[idChat]/page.tsx
import { AuthGuard } from "@/components/component/AuthGuard";

function ChatPageContent() {
  // ... nội dung page
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatPageContent />
    </AuthGuard>
  );
}
```

### **Bước 2: Tạo Login Page**

```typescript
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { login } from "@/app/api/auth";
import { setAuth } from "@/store/authSlice";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();

  const handleLogin = async () => {
    try {
      const result = await login({ username, password });

      // Lưu user info vào Redux
      dispatch(
        setAuth({
          userId: result.userId,
          username: result.username,
        })
      );

      // Redirect về chat
      router.push("/chat-uuid");
    } catch (error) {
      alert("Đăng nhập thất bại!");
    }
  };

  return (
    <div>
      <input value={username} onChange={(e) => setUsername(e.target.value)} />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Đăng nhập</button>
    </div>
  );
}
```

### **Bước 3: Tạo Logout Button**

```typescript
// components/LogoutButton.tsx
"use client";

import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { logout } from "@/app/api/auth";
import { clearAuth } from "@/store/authSlice";
import { RootState } from "@/store/store";

export function LogoutButton() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { username } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    if (!username) return;

    try {
      await logout(username);
      dispatch(clearAuth());
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return <button onClick={handleLogout}>Đăng xuất</button>;
}
```

---

## 🔒 Protected vs Public Routes

### **Public Routes** (Không cần AuthGuard)

- `/` - Home page
- `/login` - Login page
- `/register` - Register page

### **Protected Routes** (Cần wrap với AuthGuard)

- `/[idChat]` - Chat page ✅
- `/profile` - User profile
- `/settings` - Settings

---

## 🚀 Flow hoạt động

### **1. User chưa đăng nhập → Access protected route**

```
User vào /chat-123
  ↓
AuthGuard check: checkAuth()
  ↓
❌ Not authenticated
  ↓
Redirect → / (home)
```

### **2. User đăng nhập**

```
User nhập username/password → Click login
  ↓
Call: login({ username, password })
  ↓
Backend set HttpOnly cookies (accessToken, refreshToken)
  ↓
Frontend: dispatch(setAuth({ userId, username }))
  ↓
✅ Redux: isAuthenticated = true
  ↓
Redirect → /chat-123
```

### **3. User đã đăng nhập → Access protected route**

```
User vào /chat-123
  ↓
AuthGuard check: Redux isAuthenticated = true
  ↓
✅ Render ChatPageContent
```

### **4. Token hết hạn → Auto refresh**

```
API call failed (401 Unauthorized)
  ↓
Call: refreshToken()
  ↓
Backend verify refreshToken cookie
  ↓
Generate new accessToken → Set cookie
  ↓
Retry original API call
```

---

## 🛠️ Backend Requirements

**Backend PHẢI implement:**

1. ✅ `GET /api/chats/user` - Endpoint để verify token

   ```java
   @GetMapping("/api/chats/user")
   public ResponseEntity<?> getUserChats(@CookieValue("accessToken") String token) {
       // Validate token
       // Return user info + chats
   }
   ```

2. ✅ Response format từ `/api/chats/user`:

   ```json
   {
     "userId": "uuid",
     "username": "test",
     "chats": [...]
   }
   ```

3. ✅ CORS configuration:
   ```java
   .allowedOrigins("http://localhost:3000")
   .allowCredentials(true)
   ```

---

## 📝 Notes

- 🍪 **Cookies tự động gửi kèm** - Không cần thêm Authorization header
- 🔄 **Redux sync** - Auth state available toàn bộ app
- ⚡ **Loading state** - UX tốt với spinner khi check auth
- 🛡️ **Type-safe** - TypeScript types cho tất cả functions

---

## 🐛 Troubleshooting

**Problem:** AuthGuard liên tục redirect về home
**Solution:**

- Check backend `/api/chats/user` endpoint có hoạt động không
- Verify CORS `allowCredentials: true`
- Check cookies được set đúng domain

**Problem:** Cookies không được gửi kèm request
**Solution:**

- Đảm bảo `withCredentials: true` trong axios config
- Check domain frontend/backend khớp nhau (localhost:3000 ↔ localhost:8080)

---

## ✅ Checklist Implementation

- [x] Redux authSlice created
- [x] Auth API functions implemented
- [x] AuthGuard component created
- [x] ChatPage wrapped với AuthGuard
- [ ] Login page (TODO)
- [ ] Register page (TODO)
- [ ] Logout button in sidebar (TODO)
- [ ] Backend `/api/chats/user` endpoint (TODO)

---

🎉 **Happy coding!**
