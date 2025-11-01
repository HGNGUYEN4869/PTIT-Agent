"use client";

import { useDispatch, useSelector } from "react-redux";
import {
  setInput,
  setFile,
} from "../../store/chatSlice";
import { RootState } from "../../store/store";
import { ChatInput } from "@/components/component/ChatInput";
import { useRouter } from "next/navigation";
import { createChat } from "../api/chatFetch";
import { v4 as uuid } from "uuid";
import { useState } from "react";
import { CreateChatRequest } from "@/types/chat";

export default function Home() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const { input, file, isAgentMode } = useSelector((state: RootState) => state.chat);

  const handleStartChat = async (input: string, file?: File | undefined) => {
    if (!input.trim() && !file) return;
    if (input.trim()) {
      dispatch(setInput(input.trim()));
    }
    if (file) {
      dispatch(setFile(file as File));
    }
    setLoading(true);
    try {
      const createChatRequest: CreateChatRequest = {
        title: input.trim() || "New Chat",
      };
      const response = await createChat(createChatRequest);
      if (response.idChat) {
        // Chuyển hướng đến trang chat với chatId mới
        router.push(`/${response.idChat}`);
      } else {
        console.error("Failed to create chat: no chatId returned");
      }
    } catch (err) {
      console.error(err);
    } finally {
      input = "";
      file = undefined;
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full overflow-y-scroll bg-transparent content-wrap">
      <div className="absolute text-2xl font-semibold text-center transform -translate-x-1/2 -translate-y-1/2 bg-transparent pointer-events-none select-none top-1/2 left-1/2 text-muted-foreground z-3">
        Xin chào 👋 Tôi là PTIT Agent của bạn!
      </div>

      {/* 👇 Giữ cố định input ở đáy */}
      <div className={`absolute z-10 w-full py-4 mb-1 bg-transparent -bottom-0 left-1/2 -translate-x-1/2 ${isAgentMode ? 'pl-4' : 'px-72'}`}>
        <ChatInput onSend={handleStartChat} disabled={loading} />
      </div>
    </div>
  );
}
