import { LogLevel } from "@/types/common";
import { LucideIcon } from "lucide-react";
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";

const LOG_ICON_MAP: Record<LogLevel, LucideIcon> = {
  INFO: Info,
  WARNING: AlertTriangle,
  SUCCESS: CheckCircle2,
  ERROR: XCircle,
  DEFAULT: Terminal,
};

export const getLogIcon = (
  level: LogLevel,
  size = 14,
  className = ""
) => {
  const Icon = LOG_ICON_MAP[level] ?? Terminal;
  return <Icon size={size} className={className} />;
};
