"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  variant = "info",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>& {
  variant?: "info" | "success" | "error" | "warning"
}) {

  const colorMap = {
    info: "bg-blue-500",
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
  }

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all",
          colorMap[variant]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
