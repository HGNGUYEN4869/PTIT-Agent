/**
 * Agent System - Main exports (MCP Architecture)
 * Backend RAG tự execute qua MCP Server
 * Frontend chỉ giữ các utilities cho Manual Mode
 */

// Serial Port Manager - Vẫn cần cho user manual operations
export { SerialPortManager } from "./serialPortManager";

// Types - Minimal cho MCP architecture
export type { AgentResponse } from "@/types/agentSettings";
