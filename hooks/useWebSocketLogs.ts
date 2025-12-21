import { useEffect, useState } from "react";
import { LogMessage } from "@/types/webSocket";

export function useWebSocketLogs(url: string | null): { logs: LogMessage[], isClosed: boolean } {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isClosed, setIsClosed] = useState<boolean>(false);

  useEffect(() => {
    // Không connect nếu url là null
    if (!url) {
      setLogs([]);
      return;
    }

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(" WebSocket connected:", url);
      setIsClosed(false);
    };

    ws.onmessage = (event) => {
      try {
        const logMessage: LogMessage = JSON.parse(event.data);
        setLogs((prev) => [...prev, logMessage]);
      } catch (error) {
        console.error("Failed to parse log:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      setIsClosed(true);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return {
    logs,
    isClosed,
  };
}
