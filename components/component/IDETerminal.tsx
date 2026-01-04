import { useRef, useState, useEffect } from "react";
import { Terminal } from "../ui/terminal";
import { useWebSocketLogs } from "@/hooks/useWebSocketLogs";
import { toolGateway } from "@/lib/toolGateway";

type IDETerminalProps = {
  sessionId: string;
};

const IDETerminal = ({ sessionId }: IDETerminalProps) => {
  const wsRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]); // Track logs từ hook
  // State để track sessionId từ 2 nguồn:
  // 1. Từ props (user compile local test) → isAgentCompile = false
  // 2. Từ event (Agent compile) → isAgentCompile = true
  const [wsSessionId, setWsSessionId] = useState<string>(sessionId);
  const [isAgentCompile, setIsAgentCompile] = useState(false); // Distinguish Agent vs Local

  // Sync khi props sessionId thay đổi (user compile local)
  useEffect(() => {
    if (sessionId) {
      setWsSessionId(sessionId);
      setIsAgentCompile(false); // ← Local compile, không phải Agent
    }
  }, [sessionId]);

  // Subscribe event từ ToolGateway khi Agent execute compile
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCompileStarted = (data: any) => {
      setIsAgentCompile(true); // ← Agent compile
      setWsSessionId(data.sessionId); // Update ws URL động
    };

    toolGateway.on("compile_started", handleCompileStarted);

    return () => {
      toolGateway.removeListener("compile_started", handleCompileStarted);
    };
  }, []);

  // Kết nối vào WS với sessionId (có thể từ props hoặc từ Agent event)
  const wsUrl = wsSessionId
    ? `ws://ptit-agent-be-production.up.railway.app/ws/compile/${wsSessionId}`
    : null;

  const { logs, isClosed } = useWebSocketLogs(wsUrl);

  // Reset logs khi wsSessionId thay đổi (new compile session)
  useEffect(() => {
    logsRef.current = [];
  }, [wsSessionId]);

  // Track logs từ hook vào ref
  useEffect(() => {
    logsRef.current = logs.map((log) => log.message);
  }, [logs]);

  // Emit logs_collected ngay khi có logs (không chờ WS close)
  useEffect(() => {
    if (logsRef.current.length > 0) {
      // Emit logs_collected để toolGateway lưu lại
      toolGateway.emit("logs_collected", {
        logs: logsRef.current.join("\n"),
      });
    }
  }, [logs]);
  useEffect(() => {
    const el = wsRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <Terminal className="bg-[#1e1e1e] text-white font-mono h-64 overflow-y-auto w-full">
      <div
        className="w-full bg-transparent h-64 overflow-y-auto none-scrollbar -mr-8"
        ref={wsRef}
      >
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
      </div>
    </Terminal>
  );
};
export default IDETerminal;
