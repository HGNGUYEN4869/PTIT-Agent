"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/component/ChatMessage";
import { ChatInput } from "@/components/component/ChatInput";
import { Message, MessageRole } from "@/types/message";
import { v4 as uuid } from "uuid";
import { uploadRagFile } from "../../api/uploadFile";
import { ragQuery } from "../../api/ragQuery";
import { CheckCircle2Icon, X } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const chat = useSelector((state: RootState) => state.chat);
  const dispatch = useDispatch();
  const sentFromRedux = useRef(false);
  const sendFirst = useRef<boolean>(true);
  const [successUpload, setSuccessUpload] = useState<boolean>(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const params = useParams(); //{ idChat : 'abc123' }

  function formatMarkdown(content: string): string {
    return (
      content
        // ✅ Chuyển [IMAGE: ...] thành thẻ <img>
        .replace(
          /\[IMAGE:\s*(.*?)\s*\]/g,
          '<img src="$1" alt="image" style="max-width:100%;border-radius:8px;margin:8px 0;" />'
        )
        .replace(/\|[^\n]+\|\s*\n\s*\n(?=\|)/g, (m) => m.replace(/\n+/g, " "))
        // ✅ Chuẩn hóa các dòng xuống dòng
        .replace(/\\n/g, "\n")
        .replace(/\n{3,}/g, "\n")
        .trim()
    );
  }

  const handleSend = async (text: string, file?: File | undefined) => {
    const userMsg: Message = {
      role: MessageRole.USER,
      content: text,
    };
    await addMessage(userMsg, params.idChat as UUID);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      let fileId: string | undefined;

      // Nếu có file thì upload trước
      if (file) {
        const uploadRes = await uploadRagFile(file);
        fileId = uploadRes.data.file;
        setSuccessUpload(true);
        setTimeout(() => {
          setSuccessUpload(false);
        }, 2000);
      }

      if (text.trim() === "") {
        text = "Đọc file " + (fileId ? `${fileId}` : "tôi gửi");
        text += " giúp tôi và tóm tắt nội dung chính.";
      }
      // Sau đó query
      const queryRes = await ragQuery(text);
      const botMsg: Message = {
        role: MessageRole.ASSISTANT,
        content:
          formatMarkdown(queryRes.data.answer) ??
          "Không có phản hồi từ server 🤖",
      };
      if (queryRes.data.answer) {
        // Tạo message trên db
        await addMessage(botMsg, params.idChat as UUID);

        if (sendFirst.current) {
          // ✅ Trigger refresh history sidebar
          dispatch(triggerRefreshHistory());
          sendFirst.current = false;
        }
      }

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("❌ Lỗi gửi:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: MessageRole.ASSISTANT,
          content: "⚠️ Có lỗi xảy ra khi gửi tin hoặc upload file.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    //nếu không có input đầu vào
    if (!chat.input && !chat.file) {
      // 1️⃣ Không có input/file => fetch lấy chi tiết chat cũ
      const fetchDetailHistoryChat = async () => {
        try {
          const data: ChatResponse = await getDetailChat(
            params.idChat as string
          );
          setMessages(data.messages);
        } catch (err) {
          console.error(err);
        }
      };
      fetchDetailHistoryChat();
    } else if ((chat.input || chat.file) && !sentFromRedux.current) {
      // nếu có input hoặc file từ redux => gửi ngay
      handleSend(chat.input, chat.file);
      dispatch(clearChatState());
      sentFromRedux.current = true;
    }
  }, [chat.input, chat.file, dispatch]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="relative flex flex-col h-full overflow-y-scroll bg-transparent content-wrap">
      {messages.length === 0 && (
        <div className="absolute text-2xl font-semibold text-center transform -translate-x-1/2 -translate-y-1/2 bg-transparent pointer-events-none select-none top-1/2 left-1/2 text-muted-foreground z-3">
          Xin chào 👋 Tôi là PTIT Agent của bạn!
        </div>
      )}

      {/* 👉 CHỈ phần này cuộn */}
      <div className="flex-1 pt-4 pb-40 px-72 overflow-y-auto">
        {successUpload && (
          <div className="absolute top-0 right-0">
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>File upload thành công</AlertTitle>
            </Alert>
          </div>
        )}
        <div className="flex flex-col w-full gap-4">
          {messages.map((m, index) => (
            <ChatMessage
              key={`${index}-${m.content.substring(0, 30)}`}
              role={m.role}
              content={m.content}
            />
          ))}
          {loading && (
            <ChatMessage role={MessageRole.ASSISTANT} content="Đang suy nghĩ" />
          )}
          <div ref={messageEndRef} />
        </div>
      </div>

      {/* 👇 Giữ cố định input ở đáy */}
      <div className="absolute z-10 w-full py-4 mb-1 bg-transparent -bottom-0 left-1/2 -translate-x-1/2 px-72">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
