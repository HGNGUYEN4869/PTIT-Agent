// File/Image attachment info
// Có thể kèm theo trong message khi gửi be , cần thiết kế be có thể ghi được cả file và image
export interface Attachment {
  type: "image" | "file"; // image hoặc file
  name: string; // tên file
  mimeType: string; // image/png, application/pdf, etc.
  size: number; // kích thước (bytes)
  url?: string; // data URL hoặc blob URL để preview
}

export interface Message {
  idMessage?: string;
  role: MessageRole;
  content: string;
  attachment?: Attachment; // Optional - file/image kèm theo
}

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}

export interface MessageResponse extends Message {
  createdAt: string;
}

export type AddMessageResponse =
  | undefined // khi thành công (200 OK, no body)
  | { error: string };
