"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X, Mic, Square } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { uploadVoiceFile } from "@/app/api/voiceUpload";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (message: string, file?: File) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | undefined>(undefined);
  const [history, setHistory] = useState<string[]>([]); // lịch sử nhập
  const [index, setIndex] = useState<number | null>(null); // chỉ số history đang chọn
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  // Audio recorder hook
  const { isRecording, recordingTime, startRecording, stopRecording } =
    useAudioRecorder();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // Handle mic button click
  const handleMicClick = async () => {
    if (!isRecording) {
      // Start recording
      await startRecording();
    } else {
      // Stop recording & upload
      setIsUploadingVoice(true);
      try {
        const audioBlob = await stopRecording();
        if (audioBlob) {
          const voiceResponse = await uploadVoiceFile(audioBlob);
          // Set input = text lấy từ API response
          if (voiceResponse.data?.transcript) {
            setInput(voiceResponse.data.transcript);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Lỗi ghi âm";
        toast.error(errorMsg);
      } finally {
        setIsUploadingVoice(false);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    onSend(input, file || undefined);
    setInput("");
    setFile(undefined);
  };
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // chặn xuống dòng
      if (input.trim() || file) {
        onSend(input, file || undefined);
        setHistory((prev) => [...prev, input]); // lưu vào history
        setInput("");
        setFile(undefined);
        setIndex(null); // reset chỉ số history
      }
    } else if (e.key === "ArrowUp" && history.length > 0) {
      // Lấy giá trị trước đó
      setIndex((prev) => {
        const newIndex =
          prev === null ? history.length - 1 : Math.max(prev - 1, 0);
        if (newIndex >= 0) setInput(history[newIndex]);
        return newIndex;
      });
    } else if (e.key === "ArrowDown" && history.length > 0) {
      // Lấy giá trị tiếp theo
      setIndex((prev) => {
        if (prev === null) return null;
        const newIndex = Math.min(prev + 1, history.length - 1);
        setInput(history[newIndex]);
        return newIndex;
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end justify-center gap-2 py-4 bg-transparent mr-4"
    >
      {/* Nút upload file */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="p-2"
        >
          <Paperclip className="w-6 h-6" />
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
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm border rounded-md text-muted-foreground bg-background">
          <span className="truncate max-w-12.5">{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(undefined)}
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
        className="flex-1 bg-background resize-none min-h-9 h-full p-2! leading-4.5!"
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

      {/* Nút ghi âm */}
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        disabled={disabled || isUploadingVoice}
        onClick={handleMicClick}
        className="p-2 relative"
        title={isRecording ? `Ghi âm (${recordingTime}s)` : "Bắt đầu ghi âm"}
      >
        {isRecording ? (
          <>
            <Square className="w-6 h-6 fill-current" />
            <span className="absolute -top-1 -right-1 text-xs font-bold text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
              {recordingTime}
            </span>
          </>
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </Button>

      {/* Gửi */}
      <Button
        type="submit"
        disabled={disabled || (!input.trim() && !file)}
        className="p-2 bg-primary"
      >
        <Send className="w-6 h-6" />
      </Button>
    </form>
  );
}
