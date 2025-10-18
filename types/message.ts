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

export type AddMessageResponse =
  | undefined // khi thành công (200 OK, no body)
  | { error: string };