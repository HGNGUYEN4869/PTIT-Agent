/**
 * AgentWebSocketClient
 * Low-level WebSocket client để kết nối với Agent
 */

import {
  WebSocketMessage,
  WebSocketEventType,
  WebSocketEventMap,
  AgentTask,
  UserQuery,
  ToolResult,
  ErrorPayload,
} from "./types";

const DEFAULT_AGENT_WS_URL =
  process.env.NEXT_PUBLIC_AGENT_WS_URL || "ws://172.16.5.10:2222/ws";

type EventCallback<T extends WebSocketEventType> = (
  data: WebSocketEventMap[T]
) => void;

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string = "";
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // ms
  private isManuallyDisconnected = false;

  // Event listeners
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private eventListeners: Map<WebSocketEventType, Set<EventCallback<any>>> =
    new Map();

  constructor(url: string = DEFAULT_AGENT_WS_URL) {
    this.url = url;
  }

  /**
   * Connect to Agent WebSocket
   */
  async connect(sessionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          console.log("Already connected");
          resolve(true);
          return;
        }

        this.sessionId = sessionId;
        const wsUrl = `${this.url}?sessionId=${sessionId}`;

        console.log(`Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log(`WebSocket connected: sessionId=${sessionId}`);
          this.reconnectAttempts = 0;
          this.isManuallyDisconnected = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.emit("CONNECT", undefined as any);
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log(`Received: ${message.type}`);

            // Route message to specific handlers
            if (message.type === "AGENT_TASK") {
              this.emit("AGENT_TASK", message.data as AgentTask);
            } else if (message.type === "TOOL_RESULT") {
              this.emit("TOOL_RESULT", message.data as ToolResult);
            }
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.emit("ERROR", {
            code: "WS_ERROR",
            message: "WebSocket connection error",
          } as ErrorPayload);
          resolve(false);
        };

        this.ws.onclose = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.emit("DISCONNECT", undefined as any);

          // Auto-reconnect if not manually disconnected
          if (!this.isManuallyDisconnected) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error("Failed to connect:", error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect từ Agent
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send USER_QUERY to Agent
   * Query bao gồm câu hỏi + context 6 tin nhắn gần nhất
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendUserQuery(query: string, result?: Record<string, any>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return false;
    }

    const userQuery: UserQuery = {
      sessionId: this.sessionId,
      query, // Đã chứa context từ page.tsx
      result: result,
    };

    const message: WebSocketMessage = {
      type: "USER_QUERY",
      data: userQuery,
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`Sent USER_QUERY: ${JSON.stringify(message)}`);
      return true;
    } catch (error) {
      console.error("Failed to send USER_QUERY:", error);
      return false;
    }
  }

  /**
   * Send CHAT_QUERY to Agent (deprecated - use sendUserQuery instead)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendChatQuery(query: string, result?: Record<string, any>): boolean {
    return this.sendUserQuery(query, result);
  }

  /**
   * Send TOOL_RESULT to Agent
   * Unified format: error/success/data merged vào result
   * taskId removed - use sessionId for tracking
   * query: Lịch sử 6 tin nhắn gần nhất (context) - optional
   */
  sendToolResult(
    sessionId: string,
    status: "success" | "error" | "timeout",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: Record<string, any>,
    query?: string
  ): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return false;
    }

    // Unified format: tất cả thông tin nằm trong result
    const toolResult: ToolResult = {
      sessionId,
      status,
      result, // Chứa: data + message/error info
      query, // Lịch sử conversation - optional
    };

    const message: WebSocketMessage = {
      type: "TOOL_RESULT",
      data: toolResult,
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log(`Sent TOOL_RESULT: sessionId=${sessionId}, status=${status}`);
      console.log(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send TOOL_RESULT:", error);
      return false;
    }
  }

  /**
   * Subscribe to event
   */
  on<T extends WebSocketEventType>(
    event: T,
    callback: EventCallback<T>
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    const listeners = this.eventListeners.get(event)!;
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
    };
  }

  /**
   * Subscribe once (auto-unsubscribe after first call)
   */
  once<T extends WebSocketEventType>(
    event: T,
    callback: EventCallback<T>
  ): void {
    const unsubscribe = this.on(event, (data: WebSocketEventMap[T]) => {
      callback(data);
      unsubscribe();
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Private: Emit event to listeners
   */
  private emit<T extends WebSocketEventType>(
    event: T,
    data: WebSocketEventMap[T]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Private: Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached, giving up");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    setTimeout(() => {
      this.connect(this.sessionId);
    }, delay);
  }
}

// Singleton instance
export const agentWSClient = new AgentWebSocketClient();
