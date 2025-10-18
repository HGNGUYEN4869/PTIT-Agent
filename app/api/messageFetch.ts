import { db } from "@/lib/axios";
import { AddMessageResponse, Message } from "@/types/message";
import { UUID } from "crypto";

export const addMessage = async (
  Message: Message,
  idChat: UUID,
): Promise<AddMessageResponse> => {
  const response = await db.post<AddMessageResponse>(
    `/h/chats/${idChat}/messages`,
    Message,
    {
      withCredentials: true, // Gửi cookies để server xóa
    }
  );
  return response.data;
};