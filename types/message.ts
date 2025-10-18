export interface Message {
  role: MessageRole
  content: string
}

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}

export interface MessageResponse extends Message {
  createdAt: string
}