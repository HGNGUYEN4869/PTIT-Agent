"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { useFileSystem } from "@/hooks/use-file-system";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import type { FileSystemEntry } from "@/lib/fileSystemAPI";
import {
  Folder,
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Folders,
  LaptopMinimal,
  FilePlus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NewFileDialog } from "./NewFileDialog";
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
import { motion } from "framer-motion";
import { toolGateway } from "@/lib/toolGateway";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // files,
    entries,
    selectWorkingDirectory,
    loadFileList,
    loadDirectoryEntries,
    readFileContent,
    updateFileContent,
    deleteFileByName,
    createNewFile,
  } = useFileSystem();

  const [selectedFile, setSelectedFile] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<
    Map<string, FileSystemEntry[]>
  >(new Map());
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);

  // Debounce code để auto-save sau 2s không thay đổi
  const debouncedCode = useDebounce(code, 2000);

  // Lazy load folder contents khi expand
  const toggleFolder = async (folderPath: string, entry: FileSystemEntry) => {
    if (!entry.handle) return;

    if (expandedFolders.has(folderPath)) {
      // Collapse
      setExpandedFolders((prev) => {
        const newMap = new Map(prev);
        newMap.delete(folderPath);
        return newMap;
      });
    } else {
      // Expand - load children
      const children = await loadDirectoryEntries(entry.handle, folderPath);
      setExpandedFolders((prev) => {
        const newMap = new Map(prev);
        newMap.set(folderPath, children);
        return newMap;
      });
    }
  };

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
      await updateFileContent(selectedFile, debouncedCode);
    };

    autoSave();
  }, [debouncedCode, selectedFile, loading, updateFileContent]);

  // Listen for file_updated event from toolGateway
  useEffect(() => {
    const handler = async (event: any) => {
      const { fileName, toolName } = event;

      console.log(`File updated event received: ${fileName} (${toolName})`);

      // Nếu file đang được display trong editor thì reload
      if (fileName === selectedFile) {
        console.log(`Reloading file: ${selectedFile}`);

        try {
          const freshContent = await readFileContent(selectedFile);
          if (freshContent !== null) {
            setCode(freshContent);
            toast.success(`File update successfully`);
          }
          await loadFileList();
        } catch (error) {
          toast.error(`Failed to update file: ${error}`);
        }
      } else {
        await loadFileList();
        handleFileClick(fileName);
      }

      // Nếu là DELETE thì clear file explorer
      if (toolName === "TOOL_DELETE_FILE" && fileName === selectedFile) {
        setSelectedFile("");
        setCode("");
      }
    };

    toolGateway.on("file_updated", handler);

    return () => {
      toolGateway.off("file_updated", handler);
    };
  }, [selectedFile, readFileContent]);

  // Render tree với lazy loading
  const renderTree = (entries: FileSystemEntry[], level: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedFolders.has(entry.path);
      const children = expandedFolders.get(entry.path);

      if (entry.kind === "file") {
        return (
          <button
            key={entry.path}
            onClick={() => handleFileClick(entry.path)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
              selectedFile === entry.path
                ? "bg-[#7a7a7a] text-white"
                : "hover:bg-[#444444] text-gray-300"
            }`}
            style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{entry.name}</span>
          </button>
        );
      } else {
        return (
          <div key={entry.path}>
            <button
              onClick={() => toggleFolder(entry.path, entry)}
              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1 hover:bg-[#444444] text-gray-400 transition-colors"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
              <Folder className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{entry.name}</span>
            </button>
            {isExpanded && children && (
              <div>{renderTree(children, level + 1)}</div>
            )}
          </div>
        );
      }
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Lưu FULL PATH file vào ToolGateway để Agent có thể compile
    if (typeof window !== "undefined") {
      // Gửi full path (VD: "projects/led.ino") không extract chỉ filename
      (window as any).setSelectedFileFromIDE?.(fileName);
      console.log(`Selected file saved to ToolGateway: ${fileName}`);
    }

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
    // Tạo sessionId mới cho compile này
    const newSessionId = `compile-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

      //đang có bug liên quan đến lưu trùng file trong cùng cache sketch trong be cần lưu ý
    //Bắt buộc: Set sessionId vào toolGateway TRƯỚC khi compile
    // Điều này cho phép các trường hợp:
    // 1. User compile + User flash thủ công → FlashBoard lấy sessionId từ props
    // 2. Agent compile + User flash thủ công → FlashBoard lấy sessionId từ toolGateway
    // 3. Agent compile + Agent flash → ToolGateway dùng sessionId của chính nó
    toolGateway.setupCachedSessionIdCompile(newSessionId);

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

      await compileArduino(file, newSessionId, selectedBoard);

      toast.success(`Compile thành công!`);
    } catch (err) {
      const error = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      console.error("Compile error:", error);
      toast.error(
        `Lỗi compile: ${error.response?.data?.error || error.message}`
      );
      // Clear sessionId nếu compile fail
      setCompileSessionId("");
    } finally {
      setIsCompiling(false);
    }
  };

  // Handler: Create new file
  const handleCreateNewFile = async (fileName: string) => {
    if (!fileName.trim()) {
      toast.error("Vui lòng nhập tên file");
      return;
    }

    const success = await createNewFile(fileName, "");
    if (success) {
      toast.success(`Đã tạo file ${fileName}`);
      setShowNewFileDialog(false);
      await loadDirectoryEntries();
    } else {
      toast.error(`Lỗi khi tạo file ${fileName}`);
    }
  };

  // Handler: Delete selected file
  const handleDeleteFile = async () => {
    if (!selectedFile) {
      toast.error("Vui lòng chọn file để xóa");
      return;
    }

    // Confirm dialog
    if (
      !confirm(`Bạn có chắc muốn xóa file "${selectedFile.split("/").pop()}"?`)
    ) {
      return;
    }

    const success = await deleteFileByName(selectedFile);
    if (success) {
      toast.success(`Đã xóa file ${selectedFile.split("/").pop()}`);
      setSelectedFile("");
      setCode(undefined);
      await loadDirectoryEntries();
    } else {
      toast.error(`Lỗi khi xóa file ${selectedFile.split("/").pop()}`);
    }
  };

  if (!isAgentMode) return null;

  return (
    <div className="fixed left-0 top-0 w-[75vw] h-screen bg-[#101010] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-700 p-3 flex items-center justify-between bg-[#101010] shrink-0">
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
              className="gap-2 bg-[#252525] hover:bg-[#313131]"
            >
              <Folder className="w-4 h-4" />
              Chọn thư mục
            </Button>
          )}
          {directoryHandle && (
            <>
              {/* New File Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewFileDialog(true)}
                className="gap-1"
                title="Tạo file mới"
              >
                <FilePlus className="w-3 h-3" />
              </Button>

              {/* Delete File Button - chỉ hiện khi có file được chọn */}
              {selectedFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteFile}
                  className="gap-1 text-red-400 hover:text-red-600 hover:bg-[#e0e0e0]"
                  title="Xóa file"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadFileList()}
                className="gap-1"
                title="Refresh"
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
                        <SelectTrigger className="w-[200px] h-9 bg-[#252525] border-[#444444] text-white text-xs">
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
                        {isCompiling ? (
                          <>
                            <span>Đang compile</span>
                            {[0, 1, 2].map((i) => (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 1.2,
                                  delay: i * 0.25, // mỗi chấm trễ thêm 0.3s
                                  ease: "easeInOut",
                                }}
                              >
                                .
                              </motion.span>
                            ))}
                          </>
                        ) : (
                          "Compile"
                        )}
                      </Button>
                    </>
                  )}

                  {/* Flash Board - Luôn hiển thị để có thể nạp code bất kỳ lúc nào */}
                  <FlashAllBoards
                    sessionId={compileSessionId}
                    boardType={getBoardType(selectedBoard)}
                    onFlashComplete={(port) => {
                      setSerialPort(port);
                      // Store port in toolGateway for TOOL_SERIAL_READ fallback
                      toolGateway.setCurrentSerialPort(port);
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
          <div className="w-56 bg-[#101010] border-r border-gray-700 overflow-y-auto shrink-0 hide-scrollbar">
            <div className="p-3">
              <h3 className="text-xs font-semibold mb-2 text-gray-400 uppercase flex gap-2 items-center">
                <Folders /> {currentDirectory} ({entries.length})
              </h3>
              <div className="space-y-1">
                {entries.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Không có file</p>
                ) : (
                  renderTree(entries)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Monaco Editor Area */}
        <div className="flex-1 overflow-hidden">
          {!directoryHandle ? (
            <div className="flex flex-col items-center justify-center h-full text-white bg-[url('/frame-background.png')] bg-cover">
              <Folder className="w-16 h-16 mb-4 text-white" />
              <p className="text-lg mb-2">Chọn thư mục để bắt đầu</p>
              <p className="text-sm text-center px-4">
                AI sẽ tự động tạo và sửa file trong thư mục bạn chọn
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {selectedFile && (
                <div className="bg-[#101010] px-4 py-2 border-b border-gray-700 shrink-0">
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
                        value={loading ? "Loading..." : code}
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

      {/* New File Dialog */}
      <NewFileDialog
        open={showNewFileDialog}
        onOpenChange={setShowNewFileDialog}
        onCreateFile={handleCreateNewFile}
      />
    </div>
  );
}
