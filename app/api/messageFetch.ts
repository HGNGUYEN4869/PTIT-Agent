import { db } from "@/lib/axios";
import { Message } from "@/types/message";
import { UUID } from "crypto";

export const addMessage = async (
  Message: Message,
  idChat: UUID,
): Promise<any> => {
  const response = await db.post<any>(
    `/h/chats/${idChat}/messages`,
    Message,
    {
      withCredentials: true, // Gửi cookies để server xóa
    }
  );
  return response.data;
};