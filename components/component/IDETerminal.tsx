import { useEffect, useRef, useState } from "react";
import { Terminal } from "../ui/terminal";
import { useWebSocketLogs } from "@/hooks/useWebSocketLogs";

type IDETerminalProps = {
  sessionId: string;
};

const IDETerminal = ({ sessionId }: IDETerminalProps) => {
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  // Chỉ connect WebSocket khi có sessionId (đang compile) và type là terminal
  const wsUrl =
    sessionId
      ? `ws://localhost:2005/ws/compile/${sessionId}`
      : null;

  const logs = useWebSocketLogs(wsUrl);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Gửi lệnh đi
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === "") return;
    wsRef.current?.send(input);
    setInput(""); // Xóa input sau khi gửi
  };

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
            <span className="whitespace-pre-wrap break-words flex-1 min-w-0">
              {log.message.trim()}
            </span>
          </div>
        );
      })}
      {sessionId ? (
        <form onSubmit={handleSubmit} className="flex items-center mt-2">
          <span className="text-white pr-2">❯</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-[#1e1e1e] text-white outline-none flex-1"
            autoFocus
          />
        </form>
      ) : null}
    </Terminal>
  );
};
export default IDETerminal;
