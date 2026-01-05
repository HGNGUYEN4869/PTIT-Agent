"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Camera,
  AlertCircle,
  CheckCircle2,
  ScanFace,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FlashProgressToast,
  FlashProgressToastProps,
} from "./FlashProgressToast.tsx";
import { checkAccount } from "@/app/api/auth";
import { FIELD_LABELS } from "@/types/common";
import { fa } from "zod/v4/locales";

interface FaceRecognitionProps {
  onSuccess: (userInfo: {
    username: string | null;
    email?: string | null;
    stuId?: string;
    fullName?: string;
    citizenId?: string;
  }) => void;
  onBack?: () => void;
}

const TOAST_ID = "face-recognition-toast";

export default function FaceRecognition({
  onSuccess,
  onBack,
}: FaceRecognitionProps) {
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [matched, setMatched] = useState(false);
  const [showFailureDialog, setShowFailureDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [failureData, setFailureData] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognizingRef = useRef(false); // Track recognizing state realtime

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      // Check camera permissions
      const permissionStatus = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      if (permissionStatus.state === "denied") {
        toast.error("Cấp quyền truy cập camera trong cài đặt");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // Front camera (face)
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Đảm bảo video play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((error) => {});
        };
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (err.name === "NotAllowedError") {
        toast.error("Bạn đã từ chối quyền truy cập camera");
      } else if (err.name === "NotFoundError") {
        toast.error("Không tìm thấy camera trên thiết bị");
      } else {
        toast.error(
          "Không thể truy cập camera: " + (err?.message || "Unknown error")
        );
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const updateToast = (props: FlashProgressToastProps) => {
    toast.info(<FlashProgressToast {...props} />, {
      id: TOAST_ID,
      duration: Infinity,
    });
  };

  const connectAndRecognize = async () => {
    setRecognizing(true);
    startCamera();
    recognizingRef.current = true; // Update ref immediately
    setLoading(true);

    updateToast({
      title: "Đang xử lý",
      message: "Đang kết nối server...",
    });

    try {
      const wsUrl =
        process.env.NEXT_PUBLIC_FACE_RECOGNITION_WS ||
        "ws://172.16.5.10:3333/face_webcam";

      return new Promise((resolve, reject) => {
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          setLoading(false);

          // Bắt đầu capture frames từ camera
          if (!canvasRef.current || !videoRef.current) {
            return;
          }

          let lastFrameTime = 0;
          const FPS = 30;
          const FRAME_INTERVAL = 1000 / FPS; // ~33ms

          const captureAndSend = () => {
            if (
              !recognizingRef.current ||
              wsRef.current?.readyState !== WebSocket.OPEN
            ) {
              return;
            }

            const now = Date.now();

            // Kiểm tra FPS - chỉ capture nếu đủ thời gian
            if (now - lastFrameTime < FRAME_INTERVAL) {
              if (
                recognizingRef.current &&
                wsRef.current?.readyState === WebSocket.OPEN
              ) {
                requestAnimationFrame(captureAndSend);
              }
              return;
            }

            lastFrameTime = now;

            const canvas = canvasRef.current!;
            const context = canvas.getContext("2d");
            if (!context) {
              return;
            }

            context.drawImage(
              videoRef.current!,
              0,
              0,
              canvas.width,
              canvas.height
            );

            // Convert canvas to JPEG blob và gửi raw bytes
            try {
              canvas.toBlob(
                (blob) => {
                  if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current?.send(blob);
                  }
                },
                "image/jpeg",
                0.8 // Quality: 80%
              );
            } catch (error) {}

            // Tiếp tục capture với requestAnimationFrame
            if (
              recognizingRef.current &&
              wsRef.current?.readyState === WebSocket.OPEN
            ) {
              requestAnimationFrame(captureAndSend);
            }
          };

          // Đợi một chút để đảm bảo video đã sẵn sàng, rồi bắt đầu capture
          setTimeout(() => {
            captureAndSend();
          }, 100);
        };

        wsRef.current.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            // Xử lý lỗi
            if (message.type === "error" || message.type === "no_match") {
              toast.error(message?.message || "Xác thực thất bại!", {
                id: TOAST_ID,
                duration: 1500,
              });
              recognizingRef.current = false;
              setLoading(false);
              reject(new Error(message.message));
              return;
            }

            // Xử lý khi phát hiện trùng khớp (đợi xác nhận 4 giây)
            if (message.type === "match") {
              updateToast({
                title: "Đã phát hiện khuôn mặt",
                message: message?.message || "Đang xác nhận...",
                variant: "info",
              });

              return;
            }

            // Xử lý khi xác nhận thành công
            if (message.type === "final" && message.success) {
              setMatched(true);
              setRecognizing(false);
              recognizingRef.current = false;
              console.log("Success Data:", message);

              toast.success("Xác thực thành công!", {
                id: TOAST_ID,
                duration: 1500,
              });
              // Dừng camera
              stopCamera();
              // Chuyển sang RegisterForm - không cần userInfo từ WS
              setTimeout(() => {
                onSuccess({
                  username: message?.payload?.Ho_ten || "",
                  email: message?.payload?.email || "",
                  stuId: message.payload.Ma_sinh_vien || "",
                  citizenId: message.payload.Ma_so_cccd || "",
                });
                resolve(message);
              }, 1000);
              return;
            }

            // Xử lý khi xác nhận thất bại (type === "final" && !success)
            if (message.type === "final" && !message.success) {
              setRecognizing(false);
              recognizingRef.current = false;
              stopCamera();
              // Nếu payload null/undefined - đóng ws nhưng giữ camera bật để retry
              if (message.payload == null || message.payload == undefined) {
                wsRef.current?.close();
                toast.error(message.message || "Xác thực thất bại", {
                  id: TOAST_ID,
                  duration: 1500,
                });
                return; // Không reject - cho user retry
              }

              const handleCheckAccount = async (): Promise<boolean> => {
                const requestCheckAccount = {
                  stuId: message.payload.Ma_sinh_vien,
                  citizenId: message.payload.Ma_so_cccd,
                };

                const checkExistedAccount = await checkAccount(
                  requestCheckAccount
                );
                if (
                  checkExistedAccount.username === "" &&
                  checkExistedAccount.email === ""
                ) {
                  return true;
                }
                return false;
              };
              if (await handleCheckAccount()) {
                toast.error("Bạn đã xác thực nhưng chưa đăng ký tài khoản", {
                  id: TOAST_ID,
                  duration: 1500,
                });
                // Chuyển sang RegisterForm - không cần userInfo từ WS
                stopCamera();
                setTimeout(() => {
                  onSuccess({
                    username: message?.payload?.Ho_ten || "",
                    email: message?.payload?.email || "",
                    stuId: message.payload.Ma_sinh_vien || "",
                    citizenId: message.payload.Ma_so_cccd || "",
                  });
                  resolve(message);
                }, 1000);
              } else {
                setFailureData(message);
                console.log("Failure Data:", failureData);
                setShowFailureDialog(true);
                toast.error(message.message || "Xác thực thất bại", {
                  id: TOAST_ID,
                  duration: 1500,
                });
                wsRef.current?.close();
                reject(new Error(message.message || "Xác thực thất bại"));
              }
              return;
            }
          } catch (error) {
            toast.error("Lỗi kết nối WebSocket", {
              id: TOAST_ID,
              duration: 1500,
            });
          }
        };

        wsRef.current.onerror = (error) => {
          toast.error("Lỗi kết nối WebSocket");
          setRecognizing(false);
          recognizingRef.current = false;
          setLoading(false);
          reject(error);
        };

        wsRef.current.onclose = (event) => {
          // if (!matched) {
          //   toast.error("Kết nối bị đóng");
          // }
          setRecognizing(false);
          recognizingRef.current = false;
          setLoading(false);
        };

        // Timeout 30 giây
        const timeout = setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            toast.dismiss();
            toast.error("Hết thời gian xác thực (60s)", { duration: 1500 });
            setRecognizing(false);
            setLoading(false);
            wsRef.current?.close();
            reject(new Error("Timeout"));
          }
        }, 60000);

        // Clean up timeout khi success
        const originalResolve = resolve;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve = (value: any) => {
          clearTimeout(timeout);
          originalResolve(value);
        };

        const originalReject = reject;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject = (reason: any) => {
          clearTimeout(timeout);
          originalReject(reason);
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Lỗi xác thực";
      toast.error(errorMsg);
      setRecognizing(false);
      setLoading(false);
    } finally {
      toast.dismiss();
    }
    // Dừng camera
    stopCamera();
  };

  const handleCancel = () => {
    if (recognizingRef.current) {
      setRecognizing(false);
      recognizingRef.current = false;
      wsRef.current?.close();
    }
    if (onBack) onBack();
  };

  const handleFailureDialogClose = () => {
    setShowFailureDialog(false);
    setFailureData(null);
    if (onBack) onBack();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-125 shadow-lg h-fit bg-transparent backdrop-blur-sm text-white">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold">
            Xác Thực Khuôn Mặt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          {!matched && (
            <Alert className="border-blue-500 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm text-blue-100">
                {recognizing
                  ? "Đang quét khuôn mặt... Vui lòng nhìn vào camera"
                  : "Nhấn nút bên dưới để bắt đầu xác thực khuôn mặt"}
              </AlertDescription>
            </Alert>
          )}

          {/* Camera Preview */}
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover bg-black"
            />
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="hidden"
            />

            {/* Frame Overlay - Hướng dẫn vị trí chụp mặt */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* Khung tròn cho khuôn mặt */}
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative w-48 h-48 border-2 border-white rounded-full bg-cyan-500/5 flex items-center justify-center"
              >
                {/* Hình ảnh placeholder */}
                <div className="flex flex-col items-center justify-center gap-2">
                  <ScanFace className="w-16 h-16" />
                  <span className="text-xs text-white font-semibold text-center">
                    Nhìn vào camera
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Overlay khung quét (khi đang nhận diện) */}
            {recognizing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-40 h-40 border-2 border-white rounded-full"
                />
              </div>
            )}

            {/* Check mark khi thành công */}
            {matched && (
              <div className="absolute inset-0 bg-green-500/10 border border-green-500 rounded-lg flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Similarity Display */}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!recognizing && !matched && (
              <Button
                onClick={connectAndRecognize}
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Kết nối...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Bắt Đầu Xác Thực
                  </>
                )}
              </Button>
            )}

            {recognizing && (
              <Button
                onClick={() => {
                  setRecognizing(false);
                  wsRef.current?.close();
                }}
                className="w-full"
              >
                Hủy
              </Button>
            )}

            {matched && (
              <Button disabled className="w-full bg-green-600">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Xác Thực Thành Công
              </Button>
            )}

            {onBack && (
              <Button
                onClick={handleCancel}
                className="w-full text-gray-300 bg-white/10 backdrop-blur-md hover:bg-white/20 hover:backdrop-blur-xl active:bg-white/30 transition-all duration-200"
              >
                ← Quay Lại
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Failure Dialog */}
      <Dialog open={showFailureDialog} onOpenChange={setShowFailureDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Thông Tin Nhận Diện Khuôn Mặt
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Người này đã có tài khoản trên hệ thống
            </DialogDescription>
          </DialogHeader>

          {/* Failure Info Display */}
          <div className="space-y-3 py-4">
            {failureData && (
              <>
                {failureData?.payload &&
                  Object.entries(failureData.payload)
                    .filter(([key]) => key in FIELD_LABELS) // Chỉ hiển thị fields được định nghĩa
                    .map(([key, value], index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center pb-2 border-b border-slate-700"
                      >
                        {/* Tên trường */}
                        <span className="text-slate-300">
                          {FIELD_LABELS[key]}
                        </span>

                        {/* Giá trị */}
                        <span className="text-white font-medium">
                          {String(value || "---")}
                        </span>
                      </div>
                    ))}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              onClick={handleFailureDialogClose}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Quay Lại đăng nhập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
