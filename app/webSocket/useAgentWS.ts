/**
 * useAgentWS Hook
 * React hook để manage WebSocket connection với Agent
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { agentWSClient } from "./agentWSClient";
import { AgentTask, ToolResult, UserQuery, ErrorPayload } from "./types";
import { v4 as uuidv4 } from "uuid";

export interface UseAgentWSState {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  lastTask: AgentTask | null;
  lastError: ErrorPayload | null;
}

export interface UseAgentWSActions {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendQuery: (query: string, result?: Record<string, any>) => boolean;
  sendToolResult: (
    sessionId: string,
    status: "success" | "error" | "timeout",
    result?: Record<string, any>,
    query?: string
  ) => boolean;
}

export function useAgentWS(): UseAgentWSState & UseAgentWSActions {
  // State
  const [state, setState] = useState<UseAgentWSState>({
    isConnected: false,
    isConnecting: false,
    sessionId: null,
    lastTask: null,
    lastError: null,
  });

  const sessionIdRef = useRef<string | null>(null);
  const unsubscribeRefs = useRef<Array<() => void>>([]);

  /**
   * Initialize connection
   */
  const connect = useCallback(async (): Promise<boolean> => {
    if (state.isConnected || state.isConnecting) {
      console.warn("⚠️ Already connecting or connected");
      return true;
    }

    setState((prev) => ({ ...prev, isConnecting: true }));

    try {
      // Generate sessionId on FE
      const sessionId = `session_${uuidv4().substring(0, 12)}`;
      sessionIdRef.current = sessionId;

      // Connect to Agent
      const success = await agentWSClient.connect(sessionId);

      if (!success) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          lastError: {
            code: "CONNECTION_FAILED",
            message: "Failed to connect to Agent",
            sessionId,
          },
        }));
        return false;
      }

      // Setup event listeners
      setupEventListeners(sessionId);

      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        sessionId,
      }));

      console.log(`✅ Agent WS connected: ${sessionId}`);
      return true;
    } catch (error) {
      console.error("❌ Error connecting:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        lastError: {
          code: "ERROR",
          message: String(error),
        },
      }));
      return false;
    }
  }, [state.isConnected, state.isConnecting]);

  /**
   * Setup WebSocket event listeners
   */
  const setupEventListeners = (sessionId: string) => {
    // Cleanup previous listeners
    unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeRefs.current = [];

    // Listen for AGENT_TASK
    const unsubTask = agentWSClient.on("AGENT_TASK", (task: AgentTask) => {
      console.log(`📨 AGENT_TASK received: sessionId=${task.sessionId}`);
      setState((prev) => ({ ...prev, lastTask: task }));
    });
    unsubscribeRefs.current.push(unsubTask);

    // Listen for TOOL_RESULT (if needed for confirmation)
    const unsubResult = agentWSClient.on(
      "TOOL_RESULT",
      (result: ToolResult) => {
        console.log(`📨 TOOL_RESULT received: sessionId=${result.sessionId}`);
      }
    );
    unsubscribeRefs.current.push(unsubResult);

    // Listen for ERROR
    const unsubError = agentWSClient.on("ERROR", (error: ErrorPayload) => {
      const errorMsg = error?.message || String(error) || "Unknown error";
      console.error(`❌ ERROR: ${errorMsg}`);
      setState((prev) => ({
        ...prev,
        lastError: error || { code: "UNKNOWN", message: errorMsg },
      }));
    });
    unsubscribeRefs.current.push(unsubError);

    // Listen for DISCONNECT
    const unsubDisconnect = agentWSClient.on("DISCONNECT", () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
    });
    unsubscribeRefs.current.push(unsubDisconnect);
  };

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    agentWSClient.disconnect();
    unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeRefs.current = [];
    sessionIdRef.current = null;
    setState({
      isConnected: false,
      isConnecting: false,
      sessionId: null,
      lastTask: null,
      lastError: null,
    });
  }, []);

  /**
   * Send chat query to Agent
   */
  const sendQuery = useCallback((query: string, result?: Record<string, any>): boolean => {
    if (!agentWSClient.isConnected()) {
      console.error("❌ WebSocket not connected");
      return false;
    }

    return agentWSClient.sendChatQuery(query, result);
  }, []);

  /**
   * Send tool result to Agent
   * ✅ taskId removed - use sessionId for tracking
   */
  const sendToolResult = useCallback(
    (
      sessionId: string,
      status: "success" | "error" | "timeout",
      result?: Record<string, any>,
      query?: string
    ): boolean => {
      if (!agentWSClient.isConnected()) {
        console.error("❌ WebSocket not connected");
        return false;
      }

      return agentWSClient.sendToolResult(sessionId, status, result, query);
    },
    []
  );

  /**
   * Auto-cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendQuery,
    sendToolResult,
  };
}

/**
 * Custom hook for subscribing to specific events
 */
export function useAgentWSEvent<
  T extends "AGENT_TASK" | "TOOL_RESULT" | "USER_QUERY"
>(event: T, callback: (data: any) => void): void {
  useEffect(() => {
    const unsubscribe = agentWSClient.on(event, callback);

    return () => {
      unsubscribe();
    };
  }, [event, callback]);
}
