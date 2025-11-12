/**
 * Agent Response Types (MCP Architecture)
 * Backend RAG tự execute qua MCP Server, Frontend chỉ nhận kết quả
 */

export interface AgentResponse {
  answer: string;
  isAgentMode?: boolean;
  // NOTE: Không còn 'actions' - Backend tự execute qua MCP
}
