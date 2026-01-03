/**
 * WebSocket Message Types
 * Unified types cho FE-Agent communication
 */

export interface AgentTask {
  sessionId: string;
  taskId?: string;
  timestamp?: number;
  answer: string;
  toolName?: string; // if no tool, just display answer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  status?: string;
  priority?: number;
  timeout?: number;
  retryCount?: number;
}

/**
 * TOOL_RESULT - FE → Agent
 * Unified format: tất cả thông tin (error/success/data) nằm trong result
 * status + result.message/result.code = đủ để hiểu kết quả
 * query: Lịch sử 6 tin nhắn gần nhất (context) - giúp Agent hiểu ngữ cảnh
 */
export interface ToolResult {
  sessionId: string;
  status: "success" | "error" | "timeout";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: Record<string, any>; // Chứa tất cả: data, error info, message, logs
  query?: string; // Lịch sử conversation (6 tin nhắn cuối) - optional
}

/**
 * USER_QUERY - FE → Agent
 * Gửi query + conversation history (6 tin nhắn gần nhất)
 */
export interface UserQuery {
  sessionId: string;
  query: string; // Câu hỏi kèm context 6 tin nhắn gần nhất
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: Record<string, any>; // previous tool results or context
}

export interface ErrorPayload {
  code: string;
  message: string;
  sessionId?: string;
}

export type WebSocketMessage =
  | { type: "AGENT_TASK"; data: AgentTask }
  | { type: "TOOL_RESULT"; data: ToolResult }
  | { type: "USER_QUERY"; data: UserQuery }
  | { type: "ERROR"; data: ErrorPayload };

export type WebSocketEventType =
  | "AGENT_TASK"
  | "TOOL_RESULT"
  | "USER_QUERY"
  | "ERROR"
  | "CONNECT"
  | "DISCONNECT";

export interface WebSocketEventMap {
  AGENT_TASK: AgentTask;
  TOOL_RESULT: ToolResult;
  USER_QUERY: UserQuery;
  ERROR: ErrorPayload;
  CONNECT: void;
  DISCONNECT: void;
}
