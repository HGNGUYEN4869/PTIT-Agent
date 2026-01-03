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
import { Loader2, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { register } from "@/app/api/auth";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { setAuth } from "@/store/authSlice";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

//  Schema validation với zod
const loginSchema = z.object({
  username: z.string().min(3, "Username phải có ít nhất 3 ký tự"),
  email: z
    .string()
    .email("Email không hợp lệ")
    .refine((email) => email.endsWith("@stu.ptit.edu.vn"), {
      message: "Email phải thuộc domain @stu.ptit.edu.vn",
    }),
  password: z.string().min(6, "Mật khẩu phải ít nhất 6 ký tự"),
  stuId: z.string(),
  citizenId: z.string(),
});

type RegisterFormValues = z.infer<typeof loginSchema>;

interface RegisterFormProps {
  preFilledData?: {
    username: string | null;
    email?: string | null;
    stuId?: string | null;
    citizenId?: string | null;
  };
}

export default function RegisterForm({ preFilledData }: RegisterFormProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const dispatch = useDispatch();
  const router = useRouter();
  // const { isAuthenticated, userId, username } = useSelector(
  //   (state: RootState) => state.auth
  // );

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: preFilledData?.username ?? "",
      email: preFilledData?.email ?? "",
      password: "",
      stuId: preFilledData?.stuId ?? "",
      citizenId: preFilledData?.citizenId ?? "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const response = await register(values);
      if (response.userId && response.username && response.email) {
        dispatch(
          setAuth({
            userId: response.userId,
            username: response.username,
            email: response.email,
            stuId: response.stuId,
            citizenId: response.citizenId,
          })
        );
        setLoading(false);
        toast.success("Đăng ký thành công!");
        router.push("/");
      }
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      const errorMessage = err?.response?.data?.error || "Đăng ký thất bại";
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 10,
      }} // trạng thái lúc render
      animate={{
        opacity: 1,
        x: 0,
      }} // trạng thái animate
      exit={{
        opacity: 0,
        y: -20,
      }} // trạng thái khi unmount (với AnimatePresence)
      transition={{ duration: 0.5 }} // thời gian và easing
    >
      <Card className="w-[400px] shadow-lg h-fit bg-transparent backdrop-blur-sm text-white">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold">
            Đăng ký
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <UserPlus className="w-4 h-4" /> Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Username"
                        {...field}
                        disabled={!!preFilledData?.username}
                        className={cn(
                          !!preFilledData?.username &&
                            "cursor-not-allowed opacity-50 pointer-events-none"
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input
                        placeholder="Email"
                        {...field}
                        disabled={!!preFilledData?.email}
                        className={cn(
                          !!preFilledData?.email &&
                            "cursor-not-allowed opacity-50 pointer-events-none"
                        )}
                      />
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

              {/* Hidden fields - Được auto-fill từ FaceRecognition */}
              {preFilledData?.stuId && (
                <FormField
                  control={form.control}
                  name="stuId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
              )}

              {preFilledData?.citizenId && (
                <FormField
                  control={form.control}
                  name="citizenId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
              )}

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
                  "Register"
                )}
              </Button>
            </form>
          </Form>
          <Link
            href="/login"
            className="mt-6 text-sm text-center text-white hover:scale-105 duration-300 ease-in-out block"
          >
            Already have an account? Sign in now
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
