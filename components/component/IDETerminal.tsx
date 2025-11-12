import { useRef, useState } from "react";
import { Terminal } from "../ui/terminal";
import { useWebSocketLogs } from "@/hooks/useWebSocketLogs";

type IDETerminalProps = {
  sessionId: string;
};

const IDETerminal = ({ sessionId }: IDETerminalProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  // Chỉ connect WebSocket khi có sessionId (đang compile) và type là terminal
  const wsUrl =
    sessionId
      ? `ws://localhost:2005/ws/compile/${sessionId}`
      : null;

  const logs = useWebSocketLogs(wsUrl);


  return (
    <Terminal className="bg-[#1e1e1e] text-white font-mono h-[300px] overflow-y-auto w-full">
      {logs.map((log, i) => {
        // Màu sắc theo level
        const color =
          log.level === "ERROR"
            ? "text-red-500"
            : log.level === "WARNING"
            ? "text-yellow-500"
            : log.level === "SUCCESS"
            ? "text-green-500"
            : "text-white";

        return (
          <div key={i} className={`flex w-full overflow-hidden ${color}`}>
            <span className="shrink-0 pr-2">❯</span>
            <span className="whitespace-pre-wrap wrap-break-words flex-1 min-w-0">
              {log.message.trim()}
            </span>
          </div>
        );
      })}
    </Terminal>
  );
};
export default IDETerminal;
