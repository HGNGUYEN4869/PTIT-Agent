import { UUID } from "crypto"
import { Message } from "./message"

export interface Chat {
  idChat: string
  title: string
  messages: Message[]
}

export interface HistoryChat{
  historyChat: Chat[]
}

export interface CreateChatRequest {
  title: string;
}

export interface ChatResponse {
  idChat: UUID;              
  idUser: UUID;
  title: string;
  messages: Message[];
  createdAt: string;           
  updatedAt: string;        
  messageCount: number;  
}

