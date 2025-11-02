"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/app/api/auth";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { RootState } from "@/store/store";
import { setAuth } from "@/store/authSlice";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

//  Schema validation với zod
const loginSchema = z.object({
  email: z.string().email("Email phải có dạng @ptit.edu.vn"),
  password: z.string().min(6, "Mật khẩu phải ít nhất 6 ký tự"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [loading, setLoading] = useState<boolean>(false);
  const dispatch = useDispatch();
  const router = useRouter();
  // const { isAuthenticated, userId, username } = useSelector(
  //   (state: RootState) => state.auth
  // );

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const response = await login(values);
      if (response.userId && response.username && response.email) {
        dispatch(
          setAuth({
            userId: response.userId,
            username: response.username,
            email: response.email,
          })
        );
        setLoading(false);
        router.push("/");
      }
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      const errorMessage = err?.response?.data?.error || "Đăng nhập thất bại";
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 40,
      }} // trạng thái lúc render
      animate={{
        opacity: 1,
        y: 0,
      }} // trạng thái animate
      exit={{
        opacity: 0,
        x: -40,
      }} // trạng thái khi unmount (với AnimatePresence)
      transition={{ duration: 0.5 }} // thời gian và easing
    >
      <Card className="w-[400px] shadow-lg h-fit bg-transparent backdrop-blur-sm text-white">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold">
            Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Mail className="w-4 h-4" /> Email
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LockKeyhole className="w-4 h-4" /> Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Button */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? (
                  <div className="flex items-center">
                    <span>Processing </span>
                    {[0, 1, 2, 3].map((i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.2,
                          delay: i * 0.25, // mỗi chấm trễ thêm 0.3s
                          ease: "easeInOut",
                        }}
                      >
                        .
                      </motion.span>
                    ))}
                  </div>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Form>
          <Link
            href="/register"
            className="mt-6 text-sm text-center text-white hover:scale-105 duration-300 ease-in-out block"
          >
            Dont have an account? Sign up now
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
