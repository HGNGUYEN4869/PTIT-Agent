"use client";

import { Progress } from "@/components/ui/progress";

export type FlashProgressToastProps = {
  title?: string;
  message?: string;
  percentage?: number;
  variant?: "info" | "success" | "error" | "warning";
};

export function FlashProgressToast({
  title = "Đang nạp firmware",
  message,
  variant,
  percentage,
}: FlashProgressToastProps) {
  return (
    <div className="space-y-2 w-[260px]">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{message}</p>
      {percentage != null && <Progress value={percentage} variant={variant} />}
    </div>
  );
}
