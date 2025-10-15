"use client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <Card
        className={cn(
          "max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-md",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted rounded-bl-none"
        )}
      >
        <CardContent className="p-0 whitespace-pre-line">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // ✅ Hiển thị code block có highlight
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
                    }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code
                    className={cn(
                      "bg-gray-200 dark:bg-gray-800 px-1 rounded text-red-500",
                      className
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              // ✅ Tùy chỉnh link
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
              // ✅ Tùy chỉnh ảnh
              img: ({ src, alt }) => (
                <img
                  src={src ?? ""}
                  alt={alt ?? ""}
                  className="object-contain my-2 rounded-lg max-h-60"
                />
              ),
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto border border-gray-300 rounded-lg dark:border-gray-700">
                  <table className="min-w-full text-sm border-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="text-gray-800 bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => (
                <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {children}
                </tr>
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
        </CardContent>
      </Card>
    </div>
  );
}
