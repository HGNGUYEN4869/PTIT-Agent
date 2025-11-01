import { useEffect, useState } from "react";
import { LogMessage } from "@/types/webSocket";

export function useWebSocketLogs(url: string | null) {
  const [logs, setLogs] = useState<LogMessage[]>([]);

  useEffect(() => {
    // Không connect nếu url là null
    if (!url) {
      setLogs([]);
      return;
    }

    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(" WebSocket connected:", url);
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
      // WebSocket closed - silent
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return logs;
}
