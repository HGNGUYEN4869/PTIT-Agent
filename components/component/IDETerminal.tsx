import { useRef, useState, useEffect } from "react";
import { Terminal } from "../ui/terminal";
import { useWebSocketLogs } from "@/hooks/useWebSocketLogs";
import { toolGateway } from "@/lib/toolGateway";

type IDETerminalProps = {
  sessionId: string;
};

const IDETerminal = ({ sessionId }: IDETerminalProps) => {
  const wsRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<string[]>([]); // ✅ Track logs từ hook
  // State để track sessionId từ 2 nguồn:
  // 1. Từ props (user compile local test) → isAgentCompile = false
  // 2. Từ event (Agent compile) → isAgentCompile = true
  const [wsSessionId, setWsSessionId] = useState<string>(sessionId);
  const [isAgentCompile, setIsAgentCompile] = useState(false); // ✅ Distinguish Agent vs Local

  // ✅ Sync khi props sessionId thay đổi (user compile local)
  useEffect(() => {
    if (sessionId) {
      setWsSessionId(sessionId);
      setIsAgentCompile(false); // ← Local compile, không phải Agent
      console.log(
        "📝 IDETerminal received new sessionId from props (LOCAL):",
        sessionId
      );
    }
  }, [sessionId]);

  // ✅ Subscribe event từ ToolGateway khi Agent execute compile
  useEffect(() => {
    const handleCompileStarted = (data: any) => {
      console.log(
        "🔗 Agent compile started, updating terminal WS sessionId:",
        data.sessionId
      );
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
    ? `ws://localhost:2005/ws/compile/${wsSessionId}`
    : null;

  const { logs, isClosed } = useWebSocketLogs(wsUrl);

  // ✅ Track logs từ hook vào ref
  useEffect(() => {
    logsRef.current = logs.map((log) => log.message);
  }, [logs]);

  // ✅ Emit logs_collected khi:
  // 1. isClosed = true (WS vừa close)
  // 2. isAgentCompile = true (Agent mode, không phải local)
  // 3. logs có dữ liệu
  useEffect(() => {
    if (logsRef.current.length > 0 && isClosed && isAgentCompile) {
      console.log(
        `📤 Agent compile done, emitting ${logsRef.current.length} logs`
      );
      // ✅ Emit logs_collected để toolGateway lưu lại
      toolGateway.emit("logs_collected", {
        logs: logsRef.current.join("\n"),
      });
    }
  }, [isClosed, isAgentCompile]);
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
