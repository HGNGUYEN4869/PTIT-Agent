// ============= TYPE DEFINITIONS =============

/**
 * Tool names supported by the gateway
 * Total: 9 tools (8 original + TOOL_TERMINAL_READ)
 */
export type ToolName =
  | "TOOL_CREATE_FILE"
  | "TOOL_READ_FILE"
  | "TOOL_UPDATE_FILE"
  | "TOOL_DELETE_FILE"
  | "TOOL_COMPILE_ARDUINO"
  | "TOOL_UPLOAD_FIRMWARE"
  | "TOOL_TERMINAL_READ" // Read compile/upload logs from terminal
  | "TOOL_SERIAL_READ"; // Read data from serial port (Arduino/ESP32)

/**
 * AGENT_TASK - Message from Agent to Frontend
 * Frontend receives this via WebSocket and executes the tool
 *
 * Cases:
 * 1. Answer + Tool: Agent returns answer + toolName + params → FE executes tool + sends TOOL_RESULT
 * 2. Answer only: Agent returns answer without toolName → FE just displays answer (no tool execution)
 *
 * ✅ taskId removed - use sessionId for tracking instead
 */
export interface AgentTask {
  sessionId: string; // Phiên làm việc
  timestamp?: number; // Thời gian tạo (milliseconds)
  answer: string; // Câu trả lời/giải thích của Agent (bắt buộc)
  toolName?: ToolName; // Tên tool cần thực hiện (optional - nếu không có thì không cần gửi TOOL_RESULT)
  params?: Record<string, any>; // Tham số của tool (optional)
  priority?: number; // Mức độ ưu tiên (1-10, mặc định 5)
  timeout?: number; // Timeout (milliseconds, mặc định 30000)
  retryCount?: number; // Số lần retry (mặc định 0)
}

/**
 * USER_QUERY - Message from Frontend to Agent
 * Frontend sends this via WebSocket when user asks something
 */
export interface UserQuery {
  sessionId: string; // Phiên làm việc
  query: string; // Câu hỏi/yêu cầu của user (kèm context 6 tin nhắn gần nhất)
}

/**
 * TOOL_RESULT - Message from Frontend to Agent
 * Frontend sends this via WebSocket after executing a tool
 * Unified format: error info merged into result.message + result object
 *
 * ✅ taskId removed - use sessionId for tracking instead
 */
export interface ToolResult {
  sessionId: string; // Phiên làm việc (use for tracking instead of taskId)
  status: "success" | "error" | "timeout"; // Trạng thái thực thi
  result?: Record<string, any>; // Kết quả của tool - error/success/timeout info merged here
  // Chú ý: Lỗi sẽ nằm trong result.message hoặc result.code/result.error
}

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage {
  type: "AGENT_TASK" | "TOOL_RESULT" | "USER_QUERY";
  data: AgentTask | ToolResult | UserQuery;
}

/**
 * Internal queue item (deprecated - no longer used)
 * Kept for backward compatibility only
 * ✅ taskId removed - use sessionId for tracking
 */
export interface QueueItem {
  sessionId: string;
  toolName?: ToolName;
  params?: Record<string, any>;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  result?: ToolResult;
  retries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  priority: number;
  timeout: number;
}
