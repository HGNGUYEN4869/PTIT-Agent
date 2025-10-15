"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    onSend(input, file || undefined);
    setInput("");
    setFile(null);
  };
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // chặn xuống dòng
      if (input.trim() || file) {
        onSend(input, file || undefined);
        setInput("");
        setFile(null);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end justify-center gap-2 p-4 bg-transparent"
    >
      {/* Nút upload file */}
      <div className="relative">
        <Button type="button" variant="outline" size="icon" disabled={disabled} className="p-2">
          <Paperclip className="w-4 h-4" />
          <input
            type="file"
            className="absolute inset-0 h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </Button>
      </div>

      {/* Hiển thị tên file khi chọn */}
      {file && (
        <div className="flex items-center h-full gap-2 px-2 text-sm border rounded-md text-muted-foreground bg-background">
          <span className="truncate max-w-[50px]">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="hover:text-destructive"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Ô nhập text */}
      <Textarea
        placeholder="Nhập tin nhắn..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled}
        // IMPORTANT: override padding/line-height mặc định component (dùng ! để chắc chắn)
        className="flex-1 bg-background max-w-[800px] resize-none min-h-[36px] h-auto !p-2 !leading-[18px]"
        onKeyDown={handleEnter}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          // reset để đo đúng scrollHeight
          target.style.height = "auto";
          // giới hạn chiều cao (36px tới 300px)
          const newHeight = Math.min(target.scrollHeight, 300);
          target.style.height = `${Math.max(newHeight, 36)}px`;
        }}
        style={{ boxSizing: "border-box" }} // đảm bảo padding + border tính đúng
      />

      {/* Gửi */}
      <Button type="submit" disabled={disabled || (!input.trim() && !file)}>
        <Send className="w-6 h-6" />
      </Button>
    </form>
  );
}
