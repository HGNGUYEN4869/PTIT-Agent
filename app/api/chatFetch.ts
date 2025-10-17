import { api } from "../../lib/axios";

export async function getChat(idUser: string, idChat: string) {
  const res = await api.get(`/rag/chat/${idUser}/${idChat}`);
  return res.data;
}

export async function createChat(idUser: string) {
  const res = await api.post(`/rag/chat/${idUser}`);
  return res.data;
}
