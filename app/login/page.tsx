"use client";

import LoginForm from "@/components/component/LoginForm";

const LoginPage = () => {
  return (
    <div className="flex items-center justify-center fixed w-screen h-screen bg-black/80 backdrop-blur-xs top-0 left-0 z-10 bg-[url('/frame-background.png')] bg-cover bg-center text-white">
      <LoginForm />
    </div>
  );
};
export default LoginPage;
