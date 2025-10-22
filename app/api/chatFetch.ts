import { CreateChatRequest, ChatResponse, Chat, HistoryChat } from "@/types/chat";
import { db } from "../../lib/axios";

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

export const getHistoryChat = async (): Promise<HistoryChat> => {
  const response = await db.get<HistoryChat>(
    "/h/chats/user",
    {
      withCredentials: true, // ⚠️ Gửi cookie accessToken lên server
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const getDetailChat = async (chatId: string): Promise<ChatResponse> => {
  const response = await db.get<ChatResponse>(
    `/h/chats/${chatId}`,
    {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const changeTitleChat = async (chatId: string, newTitle: string): Promise<Chat> => {
  const requestBody = { title: newTitle };
  const response = await db.put<Chat>(
    `/h/chats/${chatId}/title`,
    requestBody,
    {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
export const deleteChat = async (chatId: string): Promise<Chat> => {
  const response = await db.delete<Chat>(
    `/h/chats/${chatId}`,
    {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
