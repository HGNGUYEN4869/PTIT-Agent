"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
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
import { verifyStudentCard } from "@/app/api/stuCard";
import { FIELD_LABELS } from "@/types/common";
import { CardStudentResponse } from "@/types/cardStudent";

interface StudentCardUploadProps {
  onSuccess: (cardImage: string) => void;
  onBack?: () => void;
}

export default function StudentCardUpload({
  onSuccess,
  onBack,
}: StudentCardUploadProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [cardData, setCardData] = useState<CardStudentResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const validateAndProcessImage = async (file: File) => {
    // Validate file type
    if (!["image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error("Chỉ chấp nhận file JPEG/JPG");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File quá lớn (tối đa 5MB)");
      return;
    }

    setLoading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setPreview(imageData);

        // TODO: Call API to verify student card
        const response = await verifyStudentCard(file);
        if (!response.success) {
          setLoading(false);
          toast.error(response.error);
          return;
        }
        setCardData(response);
        setVerified(true);
        setShowConfirmDialog(true);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Lỗi xử lý ảnh";
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndProcessImage(file);
    }
  };

  const startCamera = async () => {
    try {
      console.log("Requesting camera access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log("Stream acquired:", stream);

      if (videoRef.current) {
        console.log("Setting video srcObject...");
        videoRef.current.srcObject = stream;

        // Set isCameraActive immediately
        setIsCameraActive(true);
        console.log("isCameraActive set to true");

        // Thử play ngay lập tức
        videoRef.current
          .play()
          .then(() => {
            console.log("Video playing successfully");
          })
          .catch((error) => {
            console.error("Immediate play error:", error);
          });

        // Fallback: cũng add onloadedmetadata listener
        const handleLoadedMetadata = () => {
          console.log("Video metadata loaded");
          videoRef.current?.play().catch((error) => {
            console.error("Video play error on metadata:", error);
          });
        };

        videoRef.current.addEventListener(
          "loadedmetadata",
          handleLoadedMetadata
        );

        // Cleanup
        return () => {
          if (videoRef.current) {
            videoRef.current.removeEventListener(
              "loadedmetadata",
              handleLoadedMetadata
            );
          }
        };
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      console.error("Full error:", err);

      if (err.name === "NotAllowedError") {
        toast.error("Bạn đã từ chối quyền truy cập camera");
      } else if (err.name === "NotFoundError") {
        toast.error("Không tìm thấy camera trên thiết bị");
      } else {
        console.error("Camera error:", error);
        toast.error(
          "Không thể truy cập camera: " + (err?.message || "Unknown error")
        );
      }
      setIsCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    const canvas = canvasRef.current;
    context.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const imageData = canvasRef.current.toDataURL("image/jpeg");
    setPreview(imageData);

    // Stop camera
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    setIsCameraActive(false);
    // Convert canvas → Blob → File
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error("Không thể tạo ảnh");
          return;
        }

        const file = new File([blob], "student-card.jpeg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        // Gọi lại logic chung
        await validateAndProcessImage(file);
      },
      "image/jpeg",
      0.92 // quality (0 → 1)
    );
  };

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      setIsCameraActive(false);
    }
  };

  const handleProceed = () => {
    if (preview && verified) {
      onSuccess(preview);
    }
  };

  const handleConfirmDialog = () => {
    setShowConfirmDialog(false);
    toast.success("Thẻ sinh viên hợp lệ!");
    handleProceed();
  };

  const handleRejectDialog = () => {
    setShowConfirmDialog(false);
    setPreview(null);
    setVerified(false);
    setCardData(null);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-125 shadow-lg h-fit bg-transparent backdrop-blur-sm text-white">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold">
              Xác Thực Thẻ Sinh Viên
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Instructions */}
            {!preview && (
              <Alert className="border-blue-500 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-sm text-blue-100">
                  Chụp hoặc upload ảnh thẻ sinh viên (JPEG/JPG) để tiếp tục
                </AlertDescription>
              </Alert>
            )}

            {/* Camera Preview */}
            <div
              className="relative rounded-lg overflow-hidden bg-black"
              style={{ display: isCameraActive ? "block" : "none" }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover bg-black"
                style={{ display: "block" }}
              />
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="hidden"
              />

              {/* Frame Overlay - Hướng dẫn vị trí chụp */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-8">
                {/* Khung hình chữ nhật cho thẻ */}
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative w-full h-full border-2 border-white rounded-lg bg-cyan-500/5"
                >
                  {/* Hướng dẫn text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-md text-white font-semibold text-center px-2">
                      Đặt thẻ khớp vào khung
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Image Preview */}
            {preview && !isCameraActive && (
              <div className="relative rounded-lg overflow-hidden bg-black/50">
                <img
                  src={preview}
                  alt="Card preview"
                  className="w-full aspect-video object-cover"
                />
                {verified && (
                  <div className="absolute inset-0 bg-green-500/10 border border-green-500 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {!isCameraActive && !preview && (
                <>
                  <Button
                    onClick={startCamera}
                    className="w-full"
                    disabled={loading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Chụp Ảnh Từ Camera
                  </Button>

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    disabled={loading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </>
              )}

              {isCameraActive && (
                <>
                  <Button onClick={capturePhoto} className="w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    Chụp Ảnh
                  </Button>
                  <Button
                    onClick={stopCamera}
                    className="w-full bg-white/10 backdrop-blur-md hover:bg-white/20 hover:backdrop-blur-xl active:bg-white/30 transition-all duration-200"
                  >
                    Hủy
                  </Button>
                </>
              )}

              {preview && !isCameraActive && (
                <>
                  {loading ? (
                    <Button disabled className="w-full">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang xác thực...
                    </Button>
                  ) : verified ? (
                    <Button
                      onClick={handleProceed}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Tiếp Tục
                    </Button>
                  ) : (
                    <Button disabled className="w-full">
                      Lỗi xác thực
                    </Button>
                  )}

                  <Button
                    onClick={() => {
                      setPreview(null);
                      setVerified(false);
                      setLoading(false);
                    }}
                    className="w-full"
                  >
                    Chụp Lại
                  </Button>
                </>
              )}
            </div>

            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                className="w-full text-gray-300"
              >
                ← Quay Lại
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className=" border-slate-700 text-white max-w-7xl! max-h-[80vh] overflow-y-scroll hide-scrollbar bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Xác Nhận Thông Tin Thẻ Sinh Viên
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Vui lòng kiểm tra lại thông tin trước khi tiếp tục
            </DialogDescription>
          </DialogHeader>

          {/* Main Content with Image and Info */}
          <div className={`grid gap-6 py-4 ${cardData?.xoay_image_base64 ? "grid-cols-3" : "grid-cols-2"}`}>
            {/* Image Section - Left */}
            {cardData?.crop_image_base64 && (
                <img
                  src={`data:image/jpeg;base64,${cardData.crop_image_base64}`}
                  alt="Face card"
                  className={`rounded-lg border border-slate-600 w-full h-auto object-cover col-span-1`}
                />
            )}
            {cardData?.xoay_image_base64 && (
                <img
                  src={`data:image/jpeg;base64,${cardData.xoay_image_base64}`}
                  alt="Cropped card"
                  className="rounded-lg border border-slate-600 w-full h-auto object-cover col-span-1"
                />
            )}

            {/* Card Info Display - Right */}
            <div className="space-y-3 col-span-1">
              {cardData && (
                <>
                  {cardData?.extracted_info &&
                    Object.entries(cardData.extracted_info)
                      .filter(([key]) => key in FIELD_LABELS)
                      .map(([key, value], index) => (
                        <div
                          key={index}
                          className="flex justify-start gap-0.5 items-center pb-2 border-b border-slate-700"
                        >
                          {/* Tên trường */}
                          <span className="text-slate-300">
                            {FIELD_LABELS[key] ?? key}
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
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              onClick={handleRejectDialog}
              className="flex-1 bg-white/10 backdrop-blur-md
    hover:bg-white/20 hover:backdrop-blur-xl
    transition-all duration-300"
            >
              <X className="w-4 h-4 mr-2" />
              Chụp Lại
            </Button>
            <Button
              onClick={handleConfirmDialog}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Xác Nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>{" "}
    </>
  );
}
