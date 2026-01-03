"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/component/ChatMessage";
import { ChatInput } from "@/components/component/ChatInput";
import { Message, MessageRole } from "@/types/message";
import { uploadRagFile } from "../../api/uploadFile";
import { ragQuery } from "../../api/ragQuery";
import { useParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../store/store";
import {
  clearChatState,
  triggerRefreshHistory,
} from "../../../store/chatSlice";
import { addMessage } from "../../api/messageFetch";
import { UUID } from "crypto";
import { getDetailChat } from "@/app/api/chatFetch";
import { ChatResponse } from "@/types/chat";
import { toast } from "sonner";
import { toolGateway } from "@/lib/toolGateway";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatMarkdown } from "@/helper/formatMarkdown";
import { useAgentWS, AgentTask } from "@/app/webSocket";
import { agentWSClient } from "@/app/webSocket/agentWSClient";
import { FileAPI } from "@/lib/agentSystem";
import { ApiResponse, ragResponse } from "@/types/common";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<AgentTask | null>(null);
  const processedTaskIds = useRef<Set<string>>(new Set()); // Track processed tasks to avoid duplicates
  const chat = useSelector((state: RootState) => state.chat);
  const dispatch = useDispatch();
  const sentFromRedux = useRef(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const params = useParams(); //{ idChat : 'abc123' }

  const isAgentMode = chat.isAgentMode;
  const agentWS = useAgentWS();

  const [activeChat, setActiveChat] = useState<string | null>(null);
  usePageTitle(activeChat ? activeChat : "Agent PTIT");

  const handleSend = async (text: string, file?: File | undefined) => {
    text = text.trim();

    // Tạo user message (có hoặc không có attachment)
    const userMsg: Message = {
      role: MessageRole.USER,
      content: text,
      // Nếu có file → tạo attachment info + preview URL
      attachment: file
        ? {
            type: file.type.startsWith("image/") ? "image" : "file",
            name: file.name,
            mimeType: file.type,
            size: file.size,
            url: URL.createObjectURL(file), // Blob URL để preview ngay
          }
        : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    await addMessage(userMsg, params.idChat as UUID);
    setLoading(true);

    try {
      // === MODE 1: AGENT MODE (WebSocket) ===
      if (isAgentMode) {
        // Connect to Agent if not already connected
        if (!agentWS.isConnected) {
          const connected = await agentWS.connect();
          if (!connected) {
            throw new Error("Failed to connect to Agent");
          }
        }
        toolGateway.getDirectoryHandle();
        const contentFile = await FileAPI.readFile(
          toolGateway.getDirectoryHandle(),
          toolGateway.getSelectedFile()
        );

        // === Build query with context (6 last messages) ===
        // Tương tự RAG mode: lấy 6 tin nhắn gần nhất làm context
        const last6Messages = messages.slice(-6);
        const contextText = last6Messages
          .map(
            (msg) =>
              `${msg.role === MessageRole.USER ? "User" : "Assistant"}: ${
                msg.content
              }`
          )
          .join("\n");

        // Kết hợp context + query hiện tại
        const fullQueryText = contextText
          ? `Lịch sử hội thoại:\n${contextText}\n\nCâu hỏi hiện tại:\nUser: ${text}`
          : text;

        // Send USER_QUERY to Agent (kèm context)
        const success = agentWS.sendQuery(fullQueryText, {
          content: contentFile,
        });
        if (!success) {
          throw new Error("Failed to send query");
        }

        console.log("Query sent to Agent, waiting for AGENT_TASK...");
        // The AGENT_TASK will be handled by useEffect listener below
      }
      // === MODE 2: RAG MODE (HTTP) ===
      else {
        console.log("RAG Mode: Using HTTP API");

        let fileId: string | undefined;

        // Nếu có file thì upload trước
        if (file) {
          const uploadRes = await uploadRagFile(file);
          fileId = uploadRes.data.file;
          toast.success("Upload file thành công");
        }

        if (text.trim() === "") {
          text = "Đọc file " + (fileId ? `${fileId}` : "tôi gửi");
          text += " giúp tôi và tóm tắt nội dung chính.";
        }

        //  Lấy 6 tin nhắn cuối cùng làm context
        const last6Messages = messages.slice(-6);
        const contextText = last6Messages
          .map(
            (msg) =>
              `${msg.role === MessageRole.USER ? "User" : "Assistant"}: ${
                msg.content
              }`
          )
          .join("\n");

        //  Kết hợp context + text hiện tại
        const fullQueryText = contextText
          ? `Lịch sử hội thoại:\n${contextText}\n\nCâu hỏi hiện tại:\nUser: ${text}`
          : text;

        const ragQueryRes: ApiResponse<ragResponse> = await ragQuery(
          fullQueryText
        );
        const botMsg: Message = {
          role: MessageRole.ASSISTANT,
          content:
            formatMarkdown(ragQueryRes.data?.answer) ??
            "Không có phản hồi từ server",
        };
        //ưu tiên tốc độ hiển thị đưa ra ui trước
        setMessages((prev) => [...prev, botMsg]);

        // Tạo message trên db
        await addMessage(botMsg, params.idChat as UUID);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Lỗi máy chủ";
      setMessages((prev) => [
        ...prev,
        {
          role: MessageRole.ASSISTANT,
          content: errorMsg,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // === EFFECT 1: Handle AGENT_TASK messages (display answer immediately) ===
  useEffect(() => {
    if (!isAgentMode) return;

    const unsubscribe = agentWSClient.on(
      "AGENT_TASK",
      async (agentTask: AgentTask) => {
        //set luôn sesionId tránh agent trả sessionId "" hoặc null
        agentTask.sessionId = agentWSClient.getSessionId();
        console.log("Received AGENT_TASK:", agentTask);

        // Reset processedTaskIds khi nhận AGENT_TASK mới
        processedTaskIds.current.clear();

        setCurrentTask(agentTask);

        // Display answer immediately
        if (agentTask.answer) {
          const botMsg: Message = {
            role: MessageRole.ASSISTANT,
            content: formatMarkdown(agentTask.answer) ?? agentTask.answer,
          };

          setMessages((prev) => [...prev, botMsg]);
          console.log("Answer displayed, waiting for tool execution...");
          //chỗ này cũng ưu tiên hiển thị ra giao diện thật nhanh tạo ux tốt
          await addMessage(botMsg, params.idChat as UUID);
        }

        // If no tool execution needed, clear loading immediately
        if (!agentTask.toolName || agentTask.toolName === "") {
          console.log("No tool execution needed, clearing loading state");
          setLoading(false);
        }
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgentMode, dispatch, params.idChat]);

  // === EFFECT 2: Handle tool execution for AGENT_TASK ===
  useEffect(() => {
    if (!isAgentMode || !currentTask || !currentTask.toolName) return;

    // Check if this task was already processed (deduplicate)
    const taskId = currentTask.sessionId;
    if (processedTaskIds.current.has(taskId)) {
      console.log(`Task already processed, skipping: ${taskId}`);
      return;
    }
    processedTaskIds.current.add(taskId);

    let isMounted = true;

    const executeTask = async () => {
      try {
        console.log(`Executing tool via ToolGateway: ${currentTask.toolName}`);

        // Route task to toolGateway for execution (direct execute, no queue)
        const taskWithCorrectType = {
          ...currentTask,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toolName: currentTask.toolName as any,
        };
        toolGateway.receiveAgentTask(taskWithCorrectType);

        // Wait for task completion via toolGateway events
        const onTaskCompleted = (event: { sessionId: string }) => {
          if (!isMounted) return;

          if (event.sessionId === currentTask.sessionId) {
            console.log("Tool executed via ToolGateway");

            // Get the task result from toolGateway
            const taskStatus = toolGateway.getLastTaskResult();
            if (taskStatus?.result) {
              // === Lấy 6 tin nhắn cuối làm context ===
              const last6Messages = messages.slice(-6);
              const contextText = last6Messages
                .map(
                  (msg) =>
                    `${msg.role === MessageRole.USER ? "User" : "Assistant"}: ${
                      msg.content
                    }`
                )
                .join("\n");
              // === UNIFIED FORMAT: Send TOOL_RESULT kèm context ===
              const success = agentWS.sendToolResult(
                currentTask.sessionId,
                "success",
                taskStatus.result,
                currentTask.status === "success" ? "" : contextText // Gửi lịch sử conversation
              );

              if (success) {
                console.log("TOOL_RESULT sent to Agent");
              } else {
                console.error("Failed to send TOOL_RESULT");
              }
            }

            // Cleanup listener
            toolGateway.removeListener("task_completed", onTaskCompleted);
            setCurrentTask(null);
            processedTaskIds.current.clear();
            setLoading(false);
          }
        };

        toolGateway.on("task_completed", onTaskCompleted);
      } catch (error) {
        console.error("Tool execution error:", error);

        if (!isMounted) return;

        // === Lấy 6 tin nhắn cuối làm context ===
        const last6Messages = messages.slice(-6);
        const contextText = last6Messages
          .map(
            (msg) =>
              `${msg.role === MessageRole.USER ? "User" : "Assistant"}: ${
                msg.content
              }`
          )
          .join("\n");

        // === UNIFIED FORMAT: error info merged into result ===
        const errorMsg = error instanceof Error ? error.message : String(error);
        agentWS.sendToolResult(
          currentTask.sessionId,
          "error",
          { message: errorMsg },
          contextText // Gửi lịch sử context với error
        );
        processedTaskIds.current.clear();
        setCurrentTask(null);
        setLoading(false);
      }
    };

    executeTask();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask, isAgentMode, agentWS]);

  useEffect(() => {
    //nếu không có input đầu vào
    if (!chat.input && !chat.file) {
      //Không có input/file => fetch lấy chi tiết chat cũ
      const fetchDetailHistoryChat = async () => {
        try {
          const data: ChatResponse = await getDetailChat(
            params.idChat as string
          );
          setActiveChat(data.title);
          setMessages(data.messages);
        } catch (error) {
          const err = error as { response?: { data?: { error?: string } } };
          const errorMessage =
            err?.response?.data?.error || "Lỗi không xác định";
          toast.error(errorMessage);
        }
      };
      fetchDetailHistoryChat();
    } else if ((chat.input || chat.file) && !sentFromRedux.current) {
      // nếu có input hoặc file từ redux => gửi ngay
      handleSend(chat.input, chat.file);
      dispatch(triggerRefreshHistory());
      dispatch(clearChatState());
      sentFromRedux.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [chat.input, chat.file]);
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <>
      <div className="relative flex flex-col h-full overflow-y-scroll bg-transparent content-wrap">
        {messages.length === 0 && (
          <div className="absolute text-2xl font-semibold text-center transform -translate-x-1/2 -translate-y-1/2 bg-transparent pointer-events-none select-none top-1/2 left-1/2 text-muted-foreground z-3">
            Xin chào Tôi là PTIT Agent của bạn
          </div>
        )}

        {/* CHỈ phần này cuộn */}
        <div
          className={`flex-1 pt-4 pb-40 overflow-y-auto ${
            isAgentMode ? "px-4" : "2xl:px-72 xl:px-44 lg:px-32 md:px-12 px-4"
          }`}
        >
          <div className="flex flex-col w-full gap-4">
            {messages.map((m, index) => (
              <ChatMessage
                key={`${index}-${m.content.substring(0, 30)}`}
                role={m.role}
                content={m.content}
                attachment={m.attachment}
              />
            ))}
            {loading && (
              <ChatMessage
                role={MessageRole.ASSISTANT}
                content="Đang suy nghĩ"
              />
            )}
            <div ref={messageEndRef} />
          </div>
        </div>

        {/* Giữ cố định input ở đáy */}
        <div
          className={`absolute z-10 w-full py-4 mb-1 bg-transparent bottom-0 left-1/2 -translate-x-1/2 ${
            isAgentMode
              ? "px-4"
              : "2xl:px-72 xl:px-44 lg:px-32 md:pl-12 md:pr-10 pl-4"
          }`}
        >
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      </div>
    </>
  );
}
