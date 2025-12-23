"use client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import rehypeSanitize from "rehype-sanitize";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "framer-motion";
import { MessageRole } from "@/types/message";
import { BrainCircuit } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

interface ChatMessageProps {
  role: MessageRole;
  content: string;
  attachment?: {
    type: "image" | "file";
    name: string;
    mimeType: string;
    size: number;
    url?: string;
  };
}

export function ChatMessage({ role, content, attachment }: ChatMessageProps) {
  const isUser = role === MessageRole.USER;
  const chat = useSelector((state: RootState) => state.chat);
  const isAgentMode = chat.isAgentMode;

  // Helper: Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -20,
        scale: 1.2,
        translateY: 30,
        transformOrigin: isUser ? "right top" : "left top",
      }} // trạng thái lúc render
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        translateY: 0,
        transformOrigin: isUser ? "right top" : "left top",
      }} // trạng thái animate
      exit={{
        opacity: 0,
        y: 20,
        scale: 0,
        transformOrigin: isUser ? "right top" : "left top",
      }} // trạng thái khi unmount (với AnimatePresence)
      transition={{ duration: 0.5 }} // thời gian và easing
      className={cn(
        "flex w-full relative flex-col",
        isUser ? "items-end" : "items-start"
      )}
    >
      {/* Hiển thị attachment preview nếu có */}
      {attachment && (
        <div className="mb-3 p-3 bg-white rounded-lg">
          {attachment.type === "image" && attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-w-xs max-h-64 rounded-lg object-contain"
            />
          ) : (
            // File preview (không phải image)
            <div className="flex items-center gap-2 p-2 bg-white/5 rounded">
              <div className="text-2xl">📄</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {attachment.name}
                </p>
                <p className="text-xs opacity-70">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {isUser && !isAgentMode ? (
        <></>
      ) : (
        <div className="absolute top-0 bg-[#f5f5f5] p-2 rounded-full -left-10 shadow-md">
          <BrainCircuit className="w-4 h-4" />
        </div>
      )}
      <Card
        className={cn(
          "px-4 py-2 rounded-2xl text-sm shadow-md",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none max-w-[80%]"
            : content === "Đang suy nghĩ"
            ? "bg-muted rounded-bl-none w-fit"
            : "bg-muted rounded-bl-none w-full"
        )}
      >
        <CardContent className="p-0 prose max-w-none">
          {content === "Đang suy nghĩ" ? (
            <div className="flex items-center">
              <span>Đang suy nghĩ </span>
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    delay: i * 0.25,
                    ease: "easeInOut",
                  }}
                >
                  .
                </motion.span>
              ))}
            </div>
          ) : (
            <>
              {/* Hiển thị content text */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  //  Hiển thị code block có highlight
                  code({
                    inline,
                    className,
                    children,
                    ...props
                  }: {
                    inline?: boolean;
                    className?: string;
                    children?: React.ReactNode;
                  }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: "8px 0",
                          borderRadius: "0.5rem",
                          fontSize: "0.85rem",
                          innerWidth: "100%",
                          overflowX: "auto",
                        }}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        className={cn(
                          "bg-gray-200 px-1 rounded text-red-500",
                          className
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  //  Tùy chỉnh link
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                  //  Tùy chỉnh ảnh
                  img: ({ src, alt }) => (
                    <img
                      src={src ?? ""}
                      alt={alt ?? ""}
                      className="object-contain my-2 rounded-lg max-h-60"
                    />
                  ),
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto border border-gray-300 rounded-lg">
                      <table className="min-w-full text-sm border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="text-gray-800 bg-gray-100">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => (
                    <tr className="border-b border-gray-200">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-2 font-semibold text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2 align-top">{children}</td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
