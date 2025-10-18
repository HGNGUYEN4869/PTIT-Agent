import { CreateChatRequest, ChatResponse } from "@/types/chat";
import { api, db } from "../../lib/axios";

export async function getChat(idUser: string, idChat: string) {
  const res = await api.get(`/rag/chat/${idUser}/${idChat}`);
  return res.data;
}

export const createChat = async (
  CreateChatRequest: CreateChatRequest
): Promise<ChatResponse> => {
  const response = await db.post<ChatResponse>(
    "/h/chats/createChat",
    CreateChatRequest,
    {
      withCredentials: true, // ⚠️ Gửi cookie accessToken lên server
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
