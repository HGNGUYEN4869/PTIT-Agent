"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/component/ChatMessage";
import { ChatInput } from "@/components/component/ChatInput";
import { Message } from "@/types/message";
import { v4 as uuid } from "uuid";
import { uploadRagFile } from "./api/uploadFile";
import { ragQuery } from "./api/ragQuery";
import { CheckCircle2Icon, X } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [successUpload, setSuccessUpload] = useState<boolean>(false);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
        .replace(/\n\n+/g, "\n")
    );
  }

  const handleSend = async (text: string, file?: File) => {
    const userMsg: Message = { id: uuid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Giả lập phản hồi từ bot (kết nối API thật ở đây)
    // const res = await uploadRagFile()
    // const botMsg: Message = {
    //     id: uuid(),
    //     role: "assistant",
    //     content: `Bạn vừa nói: "${text}"`,
    //   }
    //   setMessages((prev) => [...prev, botMsg])
    //   setLoading(false)

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
        id: uuid(),
        role: "assistant",
        content:
          formatMarkdown(queryRes.data.answer) ??
          "Không có phản hồi từ server 🤖",
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("❌ Lỗi gửi:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "assistant",
          content: "⚠️ Có lỗi xảy ra khi gửi tin hoặc upload file.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

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
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} content={m.content} />
          ))}
          {loading && <ChatMessage role="assistant" content="Đang suy nghĩ" />}
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
