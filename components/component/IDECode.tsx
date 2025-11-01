"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { useFileSystem } from "@/hooks/use-file-system";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import {
  Folder,
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Folders,
  LaptopMinimal,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import IDEPanel from "./IDEPanel";
import FlashAllBoards from "./FlashBoard";
import { compileArduino } from "@/app/api/arduinoCompile";
import { toast } from "sonner";

// Danh sách các board được hỗ trợ
const SUPPORTED_BOARDS = [
  { fqbn: "arduino:avr:uno", name: "Arduino UNO", type: "UNO" },
  { fqbn: "arduino:avr:nano", name: "Arduino Nano", type: "UNO" },
  { fqbn: "arduino:avr:mega", name: "Arduino Mega", type: "UNO" },
  { fqbn: "esp8266:esp8266:generic", name: "ESP8266 Generic", type: "ESP8266" },
  { fqbn: "esp32:esp32:esp32", name: "ESP32 Dev Module", type: "ESP32" },
  { fqbn: "esp32:esp32:esp32s2", name: "ESP32-S2", type: "ESP32" },
  { fqbn: "esp32:esp32:esp32s3", name: "ESP32-S3", type: "ESP32" },
  { fqbn: "esp32:esp32:esp32c3", name: "ESP32-C3", type: "ESP32" },
] as const;

export function IDECode() {
  const { isAgentMode } = useSelector((state: RootState) => state.chat);
  const editorRef = useRef<any>(null);
  const [code, setCode] = useState<string | undefined>(undefined);
  const [language, setLanguage] = useState("typescript");
  const [compileSessionId, setCompileSessionId] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [serialPort, setSerialPort] = useState<SerialPort | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string>("arduino:avr:uno");

  // Helper: Convert FQBN to simple board type
  const getBoardType = (fqbn: string): string => {
    const board = SUPPORTED_BOARDS.find((b) => b.fqbn === fqbn);
    return board?.type || "UNO";
  };

  const {
    isSupported,
    directoryHandle,
    currentDirectory,
    files,
    selectWorkingDirectory,
    loadFileList,
    readFileContent,
    updateFileContent,
  } = useFileSystem();

  const [selectedFile, setSelectedFile] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [isSaving, setIsSaving] = useState(false);

  // Debounce code để auto-save sau 2s không thay đổi
  const debouncedCode = useDebounce(code, 2000);

  // Auto-save khi debouncedCode thay đổi
  useEffect(() => {
    const autoSave = async () => {
      // Chỉ auto-save khi:
      // 1. Có file đang được chọn
      // 2. Code không undefined
      // 3. Không đang loading file
      // 4. Code đã được debounce (đã dừng gõ 2s)
      if (!selectedFile || debouncedCode === undefined || loading) {
        return;
      }

      setIsSaving(true);
      const success = await updateFileContent(selectedFile, debouncedCode);

      if (success) {
      } else {
        toast.error(`❌ Lỗi khi lưu ${selectedFile.split("/").pop()}`);
      }

      setIsSaving(false);
    };

    autoSave();
  }, [debouncedCode, selectedFile, loading, updateFileContent]);

  // Tạo cấu trúc tree từ flat file list
  const buildFileTree = (files: string[]) => {
    const tree: Record<string, any> = {};

    files.forEach((filePath) => {
      const parts = filePath.split("/");
      let current = tree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        if (index < parts.length - 1) {
          current = current[part];
        }
      });
    });

    return tree;
  };

  const fileTree = buildFileTree(files);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Render tree recursively
  const renderTree = (tree: Record<string, any>, basePath: string = "") => {
    return Object.entries(tree).map(([name, children]) => {
      const fullPath = basePath ? `${basePath}/${name}` : name;
      const isFile = children === null;
      const isExpanded = expandedFolders.has(fullPath);

      if (isFile) {
        return (
          <button
            key={fullPath}
            onClick={() => handleFileClick(fullPath)}
            className={`w-full text-left px-2 py-1.5 pl-6 rounded text-xs flex items-center gap-2 transition-colors ${
              selectedFile === fullPath
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-700 text-gray-300"
            }`}
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{name}</span>
          </button>
        );
      } else {
        return (
          <div key={fullPath}>
            <button
              onClick={() => toggleFolder(fullPath)}
              className="w-full text-left px-2 py-1.5 pl-4 rounded text-xs flex items-center gap-1 hover:bg-gray-700 text-gray-400 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <Folder className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{name}</span>
            </button>
            {isExpanded && (
              <div className="ml-2">{renderTree(children, fullPath)}</div>
            )}
          </div>
        );
      }
    });
  };

  const onMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.focus();

    // Configure TypeScript compiler options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      typeRoots: ["node_modules/@types"],
      skipLibCheck: true,
      strict: false, // Disable strict mode to reduce errors
    });

    // Disable semantic validation for cleaner experience
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        1375, // 'use client' directive
        1378, // 'use server' directive
        2307, // Cannot find module '@/...'
        2304, // Cannot find name
        2305, // Module has no exported member
        2322, // Type 'X' is not assignable to type 'Y'
        2345, // Argument of type 'X' is not assignable to parameter of type 'Y'
        2352, // Conversion of type 'X' to type 'Y' may be a mistake
        2353, // Object literal may only specify known properties
        2769, // No overload matches this call
        2339, // Property 'X' does not exist on type 'Y'
        2571, // Object is of type 'unknown'
        2578, // Unused '@ts-expect-error' directive
        2740, // Type 'X' is missing the following properties from type 'Y'
        7016, // Could not find a declaration file
        7006, // Parameter 'X' implicitly has an 'any' type
        6133, // Variable is declared but never used
        6196, // 'X' is declared but its value is never read
        8010,
        8016,
        8009,
        1011,
      ],
    });

    // Configure JavaScript defaults similarly
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        1375, 1378, 2307, 2304, 2322, 2345, 2352, 2339, 2571, 2740, 7016, 7006,
        6133, 8010, 8016, 8009, 1011,
      ],
    });
  };

  const handleFileClick = async (fileName: string) => {
    setLoading(true);
    setSelectedFile(fileName);

    // Detect language từ file extension
    const ext = fileName.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      // JavaScript/TypeScript
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",

      // C/C++
      c: "c",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      "c++": "cpp",
      h: "c",
      hpp: "cpp",
      hh: "cpp",
      hxx: "cpp",
      ino: "c",

      // Python
      py: "python",
      pyw: "python",

      // Java
      java: "java",

      // C#
      cs: "csharp",

      // Web
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",

      // Data
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",

      // Markup
      md: "markdown",
      markdown: "markdown",

      // Shell
      sh: "shell",
      bash: "shell",
      zsh: "shell",

      // Other
      sql: "sql",
      go: "go",
      rs: "rust",
      php: "php",
      rb: "ruby",
      swift: "swift",
      kt: "kotlin",
      dart: "dart",
      r: "r",
      m: "objective-c",
      txt: "plaintext",
    };
    setLanguage(langMap[ext || ""] || "plaintext");

    const content = await readFileContent(fileName);
    if (content !== null) {
      setCode(content);
    }
    setLoading(false);
  };

  const handleCompileArduino = async () => {
    if (!selectedFile || !selectedFile.endsWith(".ino") || code === undefined) {
      toast.error("Vui lòng chọn file .ino trước khi compile");
      return;
    }

    setIsCompiling(true);
    // Generate unique session ID
    const newSessionId = `compile-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    // Set sessionId TRƯỚC để WebSocket connect trước khi compile
    setCompileSessionId(newSessionId);

    // Đợi một chút để WebSocket connect
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      // Tạo file blob từ code
      const blob = new Blob([code], { type: "text/plain" });
      const file = new File(
        [blob],
        selectedFile.split("/").pop() || "sketch.ino",
        {
          type: "text/plain",
        }
      );

      toast.info(`Đang compile ${file.name}...`);

      const data = await compileArduino(file, newSessionId, selectedBoard);

      toast.success(`Compile thành công!`);
    } catch (err: any) {
      console.error("Compile error:", err);
      toast.error(`Lỗi compile: ${err.response?.data?.error || err.message}`);
      // Clear sessionId nếu compile fail
      setCompileSessionId("");
    } finally {
      setIsCompiling(false);
    }
  };

  if (!isAgentMode) return null;

  return (
    <div className="fixed left-0 top-0 w-[75vw] h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-700 p-3 flex items-center justify-between bg-gray-800 shrink-0">
        <h1 className="text-sm font-bold text-white flex items-center gap-2">
          <LaptopMinimal /> IDE Code Editor
        </h1>

        {!isSupported && (
          <Alert className="bg-yellow-900 border-yellow-700 py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-yellow-200 text-xs">
              Trình duyệt không hỗ trợ. Vui lòng dùng Chrome/Edge.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          {isSupported && (
            <Button
              onClick={selectWorkingDirectory}
              size="sm"
              className="gap-2"
            >
              <Folder className="w-4 h-4" />
              Chọn thư mục
            </Button>
          )}
          {directoryHandle && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadFileList()}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>

              {selectedFile && (
                <>
                  {/* Compile Arduino (chỉ hiện khi là file .ino) */}
                  {selectedFile.endsWith(".ino") && (
                    <>
                      {/* Board Selector */}
                      <Select
                        value={selectedBoard}
                        onValueChange={setSelectedBoard}
                      >
                        <SelectTrigger className="w-[200px] h-9 bg-gray-700 border-gray-600 text-white text-xs">
                          <SelectValue placeholder="Chọn board" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_BOARDS.map((board) => (
                            <SelectItem key={board.fqbn} value={board.fqbn}>
                              {board.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        onClick={handleCompileArduino}
                        disabled={isCompiling}
                        className="gap-1 bg-orange-600 hover:bg-orange-700"
                      >
                        {isCompiling ? "Đang compile..." : "Compile"}
                      </Button>
                    </>
                  )}

                  {/* Flash Board - Luôn hiển thị để có thể nạp code bất kỳ lúc nào */}
                  <FlashAllBoards
                    sessionId={compileSessionId}
                    boardType={getBoardType(selectedBoard)}
                    onFlashComplete={(port) => {
                      toast.success(
                        "Flash hoàn tất! Port sẵn sàng cho Serial Monitor"
                      );
                      setSerialPort(port);
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {/* File Explorer Sidebar */}
        {directoryHandle && (
          <div className="w-56 bg-gray-800 border-r border-gray-700 overflow-y-auto shrink-0 hide-scrollbar">
            <div className="p-3">
              <h3 className="text-xs font-semibold mb-2 text-gray-400 uppercase flex gap-2 items-center">
                <Folders /> {currentDirectory} ({files.length})
              </h3>
              <div className="space-y-1">
                {files.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Không có file</p>
                ) : (
                  renderTree(fileTree)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Monaco Editor Area */}
        <div className="flex-1 overflow-hidden">
          {!directoryHandle ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-900">
              <Folder className="w-16 h-16 mb-4 text-gray-600" />
              <p className="text-lg mb-2">Chọn thư mục để bắt đầu</p>
              <p className="text-sm text-center px-4">
                AI sẽ tự động tạo và sửa file trong thư mục bạn chọn
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {selectedFile && (
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 shrink-0">
                  <span className="font-mono text-xs text-blue-400">
                    {selectedFile}
                  </span>
                  <span className="text-xs text-gray-500 ml-3">
                    {code?.split("\n").length || 0} lines
                  </span>
                </div>
              )}
              <div className="flex-1">
                {selectedFile ? (
                  <div className="flex flex-col w-full h-full">
                    <div className="flex-1 h-full">
                      <Editor
                        height="100%"
                        width="100%"
                        value={loading ? "// Loading..." : code}
                        onChange={(value) => setCode(value)}
                        language={language}
                        theme="vs-dark"
                        onMount={onMount}
                        options={{
                          minimap: { enabled: true },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                    <IDEPanel
                      isCompiling={isCompiling}
                      compileSessionId={compileSessionId}
                      serialPort={serialPort}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <FileText className="w-16 h-16 mb-4 text-gray-600" />
                    <p className="text-sm">
                      Chọn một file để bắt đầu chỉnh sửa
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
