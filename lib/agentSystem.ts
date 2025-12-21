/**
 * Agent System - Main exports (Event-Driven Queue Architecture)
 *
 * ARCHITECTURE:
 * - Backend Agent (Python) sends AGENT_TASK via WebSocket
 * - Frontend uses ToolGateway to receive tasks, execute locally, return TOOL_RESULT
 *
 * TYPE SOURCES:
 * - Primary task types: AgentTask, ToolResult, ToolName, WebSocketMessage (from taskAgent.ts)
 */

// ============= PRIMARY TYPES (from toolGateway.ts) =============

// Tool Gateway - Nhận AGENT_TASK, execute, emit TOOL_RESULT
export { ToolGateway, toolGateway } from "./toolGateway";

// Export NEW primary types (source of truth)
export type {
  ToolName, // ToolName enum: "TOOL_CREATE_FILE" | "TOOL_READ_FILE" | ...
  AgentTask, // NEW format: { sessionId, toolName, params, priority, timeout }
  ToolResult, // NEW format: { sessionId, status, result/error }
  WebSocketMessage, // Wrapper: { type, data }
  QueueItem, // Internal queue item structure (deprecated - no longer used)
} from "@/types/taskAgent";

// ============= HELPER EXPORTS =============

// Serial Port Manager - Quản lý Serial Port connections
// export { SerialPortManager } from "./serialPortManager";

// Serial API Helpers - Utilities cho serial operations
export * as SerialAPI from "./serialAPI";

// File System API Helpers - Utilities cho file operations
export * as FileAPI from "./fileSystemAPI";
