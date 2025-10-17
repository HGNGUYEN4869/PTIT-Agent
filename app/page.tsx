"use client";

import { useDispatch, useSelector } from "react-redux";
import { setInput, setFile } from "../store/chatSlice";
import { RootState } from "../store/store";
import { ChatInput } from "@/components/component/ChatInput";
import { useRouter } from "next/navigation";
import { createChat } from "./api/chatFetch";
import { useState } from "react";

export default function Home() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const { input, file } = useSelector((state: RootState) => state.chat);

  const handleStartChat = async (input: string, file?: File | undefined) => {
    if (!input.trim() && !file) return;
    dispatch(setInput(input.trim()));
    dispatch(setFile(file as File));
    input = "";
    file = undefined
    setLoading(true);
    try {
      // if (sessionStorage.getItem("idUser")) {
      //   const thread = await createChat("1" /* giả sử user id là 1 */);
      //   router.push(`/${thread.id}`);
      // } else {
      router.push("/akldsfghjjklfghksdfgh"); // id tạm thời cho user chưa đăng nhập
      // }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full overflow-y-scroll bg-transparent content-wrap">
      <div className="absolute text-2xl font-semibold text-center transform -translate-x-1/2 -translate-y-1/2 bg-transparent pointer-events-none select-none top-1/2 left-1/2 text-muted-foreground z-3">
        Xin chào 👋 Tôi là PTIT Agent của bạn!
      </div>

      {/* 👇 Giữ cố định input ở đáy */}
      <div className="absolute z-10 w-full py-4 mb-1 bg-transparent -bottom-0 left-1/2 -translate-x-1/2 px-72">
        <ChatInput onSend={handleStartChat} disabled={loading} />
      </div>
    </div>
  );
}
