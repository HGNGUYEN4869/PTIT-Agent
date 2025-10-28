/**
 * Utility để parse code từ backend response và tự động tạo/sửa files
 */

export interface CodeOperation {
  type: "create" | "update" | "delete";
  path: string;
  content?: string;
  language?: string;
}

/**
 * Parse markdown code blocks từ AI response
 * Format mong đợi:
 *
 * ```cpp:src/main.cpp
 * #include <iostream>
 * int main() {
 *   std::cout << "Hello World" << std::endl;
 *   return 0;
 * }
 * ```
 *
 * Hỗ trợ tất cả các ngôn ngữ: cpp, c, java, python, typescript, javascript, etc.
 */
export function parseCodeBlocksFromMarkdown(markdown: string): CodeOperation[] {
  const operations: CodeOperation[] = [];

  // Regex để match code blocks với format: ```language:filepath
  const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const [, language, filepath, content] = match;

    operations.push({
      type: "create", // hoặc 'update' nếu file đã tồn tại
      path: filepath.trim(),
      content: content.trim(),
      language: normalizeLanguageName(language.toLowerCase()),
    });
  }

  return operations;
}

/**
 * Normalize language names để phù hợp với Monaco Editor
 */
function normalizeLanguageName(lang: string): string {
  const languageMap: Record<string, string> = {
    // C/C++
    "c++": "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "c",
    hpp: "cpp",

    // JavaScript/TypeScript
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",

    // Python
    py: "python",

    // Web
    html: "html",
    css: "css",
    scss: "scss",

    // Data
    json: "json",
    yml: "yaml",

    // Markup
    md: "markdown",

    // Shell
    sh: "shell",
    bash: "shell",

    // Others
    cs: "csharp",
    go: "go",
    rs: "rust",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
  };

  return languageMap[lang] || lang;
}

/**
 * Parse từ JSON structure
 * Format mong đợi từ backend:
 *
 * {
 *   "operations": [
 *     {
 *       "type": "create",
 *       "path": "src/App.tsx",
 *       "content": "...",
 *       "language": "typescript"
 *     }
 *   ]
 * }
 */
export function parseCodeOperationsFromJSON(json: string): CodeOperation[] {
  try {
    const data = JSON.parse(json);
    return data.operations || [];
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return [];
  }
}

/**
 * Detect operation type (create vs update) dựa trên file đã tồn tại
 */
export async function detectOperationType(
  dirHandle: FileSystemDirectoryHandle,
  filepath: string
): Promise<"create" | "update"> {
  try {
    // Thử lấy file handle, nếu throw error = file chưa tồn tại
    await dirHandle.getFileHandle(filepath);
    return "update";
  } catch {
    return "create";
  }
}

/**
 * Extract file operations từ AI response text
 * Hỗ trợ nhiều format:
 * 1. Markdown code blocks với filepath
 * 2. JSON operations
 * 3. Inline file mentions
 */
export function extractFileOperations(aiResponse: string): CodeOperation[] {
  const operations: CodeOperation[] = [];

  // 1. Try parsing as markdown code blocks
  const markdownOps = parseCodeBlocksFromMarkdown(aiResponse);
  if (markdownOps.length > 0) {
    operations.push(...markdownOps);
  }

  // 2. Try parsing as JSON
  if (aiResponse.includes('"operations"')) {
    const jsonOps = parseCodeOperationsFromJSON(aiResponse);
    operations.push(...jsonOps);
  }

  return operations;
}
