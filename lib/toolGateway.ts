import { EventEmitter } from "events";
import * as FileAPI from "./fileSystemAPI";
import * as SerialAPI from "./serialAPI";
import { AgentTask, ToolResult } from "@/types/taskAgent";
import { compileArduino } from "@/app/api/arduinoCompile";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ToolGateway extends EventEmitter {
  private lastTaskResult: ToolResult | null = null; // Store last task result
  private cachedDirHandle: any = null; // Cached directory handle from Redux
  private cachedSelectedFile: string = ""; // Cached selected file from IDE
  private lastCompileLogs: string = ""; // Store compile logs from Terminal emit
  private currentSerialPort: any = null; // Store current serial port from flash
  private currentBaudRate: number = 9600; // Store current baud rate (default 9600)
  private cachedSessionIdCompile: string = "";

  constructor() {
    super();
    this.setupGateway();
    this.setupLogsListener();
  }

  //Listen log terminal
  private setupLogsListener() {
    this.on("logs_collected", (data: any) => {
      this.lastCompileLogs = data?.logs || "";
    });
  }
  //Listen sessionId tạo cho compile
  public setupCachedSessionIdCompile(sessionId: string) {
    this.cachedSessionIdCompile = sessionId;
  }
  public getCachedSessionIdCompile() {
    return this.cachedSessionIdCompile;
  }
  public clearCachedSessionIdCompile() {
    this.cachedSessionIdCompile = "";
  }

  /**
   * Setup gateway to listen for messages from Agent
   */
  private setupGateway() {
    // Listen for postMessage from Web Worker / iframe (legacy support)
    window.addEventListener("message", (event) => {
      // Validate origin for security
      if (event.origin !== window.location.origin) {
        console.warn("Invalid origin:", event.origin);
        return;
      }

      const message = event.data;

      // Handle incoming task from Agent
      if (message.type === "AGENT_TASK" && message.data) {
        const agentTask: AgentTask = message.data;
        this.receiveAgentTask(agentTask);
      }
    });
  }

  private validateAgentTask(task: any): task is AgentTask {
    if (!task || typeof task !== "object") {
      console.error("Task is not an object");
      return false;
    }

    // Chỉ yêu cầu: sessionId, answer (bắt buộc)
    // toolName và params là optional
    const required = ["sessionId"];
    const missing = required.filter((key) => !(key in task));

    if (missing.length > 0) {
      console.error(`Task missing required fields: ${missing.join(", ")}`);
      return false;
    }

    if (typeof task.sessionId !== "string") {
      console.error("sessionId must be string");
      return false;
    }

    // toolName optional - nếu có thì phải là string
    if (task.toolName && typeof task.toolName !== "string") {
      console.error("toolName must be string if provided");
      return false;
    }

    // params optional - nếu có thì phải là object
    if (
      task.params &&
      (typeof task.params !== "object" || task.params === null)
    ) {
      console.error("params must be object if provided");
      return false;
    }

    return true;
  }

  public receiveAgentTask(task: AgentTask) {
    // Validate task structure
    if (!this.validateAgentTask(task)) {
      console.error("Invalid AGENT_TASK received");
      return;
    }

    const { sessionId, toolName } = task;

    // === CASE 1: Answer only (không có toolName) ===
    if (!toolName) {
      console.log(
        `Gateway received AGENT_TASK (answer only): sessionId=${sessionId}`
      );
      console.log(`   Answer: ${task.answer}`);

      // Emit event để FE biết không cần thực thi tool
      this.emit("task_answer_only", {
        sessionId,
        answer: task.answer,
      });

      return; // Không execute, không queue
    }

    // === CASE 2: Answer + Tool (có toolName) ===
    // Direct execution - no queue needed (Agent waits for result)
    this.executeTaskDirect(task);
  }

  // Agent chỉ gửi 1 task 1 lần, chờ result rồi mới gửi task tiếp
  private async executeTaskDirect(task: AgentTask) {
    const { sessionId, toolName, params } = task;

    try {
      // console.log(`Executing task: ${sessionId} (${toolName})`);

      // Execute task by routing to handler
      let result: any;

      switch (toolName) {
        case "TOOL_CREATE_FILE":
          result = await this.handleCreateFile(params);
          break;

        case "TOOL_READ_FILE":
          result = await this.handleReadFile(params);
          break;

        case "TOOL_UPDATE_FILE":
          result = await this.handleUpdateFile(params);
          break;

        case "TOOL_DELETE_FILE":
          result = await this.handleDeleteFile(params);
          break;

        case "TOOL_COMPILE_ARDUINO":
          result = await this.handleCompileArduino(params);
          break;

        case "TOOL_UPLOAD_FIRMWARE":
          result = await this.handleUploadFirmware();
          break;

        case "TOOL_TERMINAL_READ":
          result = await this.handleTerminalRead();
          break;

        case "TOOL_SERIAL_READ":
          result = await this.handleSerialRead(params);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      // === SUCCESS: Store result and emit event ===
      const toolResult: ToolResult = {
        sessionId,
        status: "success",
        result: result,
      };

      this.lastTaskResult = toolResult;
      console.log(`Task completed: ${sessionId}`);

      // Emit file_updated event nếu là TOOL_UPDATE_FILE / TOOL_CREATE_FILE / TOOL_DELETE_FILE
      if (
        toolName === "TOOL_UPDATE_FILE" ||
        toolName === "TOOL_CREATE_FILE" ||
        toolName === "TOOL_DELETE_FILE"
      ) {
        const fileName = params?.fileName || this.cachedSelectedFile;
        if (fileName) {
          this.emit("file_updated", {
            fileName,
            toolName,
            timestamp: Date.now(),
          });
        }
      }

      this.emit("task_completed", { sessionId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const toolResult: ToolResult = {
        sessionId,
        status: "error",
        result: {
          message: errorMessage,
          code: "EXECUTION_FAILED",
          toolName,
        },
      };

      this.lastTaskResult = toolResult;
      console.error(`Task failed: ${sessionId}`, error);

      this.emit("task_completed", { sessionId });
    }
  }

  private async handleCreateFile(params: any): Promise<any> {
    const { fileName, content } = params || {}; // Handle params = undefined
    const dirHandle = this.cachedDirHandle;

    try {
      if (!fileName || !content) {
        throw new Error(
          "Thiếu thông tin. Cần cung cấp: tên file (fileName) và nội dung (content)"
        );
      }

      if (!dirHandle) {
        throw new Error(
          "Chưa chọn thư mục. Vui lòng chọn thư mục làm việc trong IDE trước."
        );
      }

      // Use dirHandle to create file
      await FileAPI.createFile(dirHandle, fileName, content);
      return {
        message: `File created: ${fileName}`,
      };
    } catch (error) {
      throw new Error(`Failed to create file: ${error}`);
    }
  }

  private async handleReadFile(params: any): Promise<any> {
    let { fileName } = params || {}; // Handle params = undefined
    const dirHandle = this.cachedDirHandle;

    try {
      // Fallback: use selected file from IDE if fileName not provided
      if (!fileName) {
        fileName = this.cachedSelectedFile;
        if (fileName) {
          console.log(`Using selected file from IDE: ${fileName}`);
        }
      }

      if (!fileName || fileName === "") {
        throw new Error(
          "Không có file được chọn. Vui lòng chọn file trong IDE hoặc cung cấp tên file cụ thể."
        );
      }

      if (!dirHandle) {
        throw new Error(
          "Chưa chọn thư mục. Vui lòng chọn thư mục làm việc trong IDE trước."
        );
      }

      // Use dirHandle to read file
      const content = await FileAPI.readFile(dirHandle, fileName);

      // Return object with fileName + content
      return {
        fileName,
        content,
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  private async handleUpdateFile(params: any): Promise<any> {
    const { fileName: initialFileName, content } = params || {}; // Handle params = undefined
    let fileName = initialFileName;
    const dirHandle = this.cachedDirHandle;

    try {
      // Fallback: use selected file from IDE if fileName not provided
      if (!fileName) {
        fileName = this.cachedSelectedFile;
        if (fileName) {
          console.log(`Using selected file from IDE: ${fileName}`);
        }
      }

      if (!fileName || fileName === "") {
        throw new Error(
          "Không có file được chọn. Vui lòng chọn file trong IDE hoặc cung cấp tên file cụ thể."
        );
      }

      if (!dirHandle) {
        throw new Error(
          "Chưa chọn thư mục. Vui lòng chọn thư mục làm việc trong IDE trước."
        );
      }

      // === STEP 1: Nếu không có content → đọc file + trả về (giống READ_FILE) ===
      if (!content) {
        const fileContent = await FileAPI.readFile(dirHandle, fileName);
        return {
          fileName,
          content: fileContent,
          message: `File read for update: ${fileName}`,
        };
      }

      // === STEP 2: Nếu có content → update file ===
      await FileAPI.updateFile(dirHandle, fileName, content);
      return {
        message: `File updated: ${fileName}`,
      };
    } catch (error) {
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  private async handleDeleteFile(params: any): Promise<any> {
    let { fileName } = params || {}; // Handle params = undefined
    const dirHandle = this.cachedDirHandle;

    try {
      // Fallback: use selected file from IDE if fileName not provided
      if (!fileName) {
        fileName = this.cachedSelectedFile;
        if (fileName) {
          console.log(`Using selected file from IDE: ${fileName}`);
        }
      }

      if (!fileName || fileName === "") {
        throw new Error(
          "Không có file được chọn. Vui lòng chọn file trong IDE hoặc cung cấp tên file cụ thể."
        );
      }

      if (!dirHandle) {
        throw new Error(
          "Chưa chọn thư mục. Vui lòng chọn thư mục làm việc trong IDE trước."
        );
      }

      // Use dirHandle to delete file
      await FileAPI.deleteFile(dirHandle, fileName);
      return {
        message: `File deleted: ${fileName}`,
      };
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  private async handleCompileArduino(params: any): Promise<any> {
    const { fileName: initialFileName, board = "arduino:avr:uno" } =
      params || {};
    let fileName = initialFileName;

    try {
      // Fallback: Nếu fileName empty hoặc không có → dùng cachedSelectedFile
      if (!fileName || fileName === "") {
        fileName = this.cachedSelectedFile;
        if (fileName) {
          console.log(`Using selected file from IDE: ${fileName}`);
        }
      }

      // Validate inputs
      if (!fileName || fileName === "") {
        throw new Error(
          "Không có file được chọn. Vui lòng chọn file trong IDE."
        );
      }

      // Sử dụng sessionId từ task, nếu null/empty thì auto-generate
      // sessionId chỉ dùng để connect WS lấy compile logs
      const sessionId = this.generateSessionId();
      this.cachedSessionIdCompile = sessionId;

      if (!this.cachedDirHandle) {
        throw new Error(
          "Chưa chọn thư mục. Vui lòng chọn thư mục làm việc trong IDE trước."
        );
      }

      // Lấy file từ dirHandle - try full path first, then filename only
      let file: string;
      try {
        file = await FileAPI.readFile(this.cachedDirHandle, fileName);
      } catch (readError) {
        // If full path fails, try extracting just filename for root-level files
        const justFileName = fileName.split("/").pop();
        if (justFileName && justFileName !== fileName) {
          // console.log(
          //   `Failed to read "${fileName}", trying "${justFileName}"...`
          // );
          file = await FileAPI.readFile(this.cachedDirHandle, justFileName);
        } else {
          throw readError;
        }
      }

      // Tạo File object từ content
      const fileBlob = new Blob([file], { type: "text/plain" });
      const fileObj = new File([fileBlob], fileName, { type: "text/plain" });

      // console.log(`Compiling ${fileName} (${board})...`);

      // Emit event để IDETerminal kết nối vào WS đúng sessionId
      this.emit("compile_started", { sessionId, fileName, board });

      // Gọi API compile
      const response = await compileArduino(fileObj, sessionId, board);

      console.log(`Compile response:`, response);

      // === Logs được stream qua WebSocket, không lấy từ response ===
      // Return compile status + sessionId để FE có thể connect WS nếu cần
      const resultMessage =
        response?.message || "Compilation completed successfully";

      return {
        status: response?.status || "success",
        message: resultMessage,
        sessionId, // Logs stream qua ws://localhost:2005/ws/compile/{sessionId}
        compilationTime: response?.compilationTime || null,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(
        `Compilation failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  private async handleUploadFirmware(): Promise<any> {
    return new Promise((resolve, reject) => {
      // nghe kết quả hành vi flash
      const onFlashComplete = (data: any) => {
        console.log("Flash completed successfully:", data);
        this.removeListener("flash_complete", onFlashComplete);
        this.removeListener("flash_error", onFlashError);

        // Clear sessionId sau khi flash xong
        // Nếu flashSessionId được truyền từ FlashBoard, dùng nó
        // Nếu không thì dùng cachedSessionIdCompile
        const sessionIdToClean =
          data.flashSessionId || this.cachedSessionIdCompile;
        if (sessionIdToClean) {
          this.clearCachedSessionIdCompile();
        }

        resolve({
          message: `Firmware uploaded successfully to ${data.boardType}`,
          port: data.port,
          boardType: data.boardType,
        });
      };

      const onFlashError = (error: any) => {
        console.error("Flash failed:", error);
        this.removeListener("flash_complete", onFlashComplete);
        this.removeListener("flash_error", onFlashError);

        // Clear sessionId ngay cả khi lỗi để tránh bị stuck
        if (error.flashSessionId) {
          this.clearCachedSessionIdCompile();
        }

        reject(new Error(`Flash failed: ${error.message || error}`));
      };

      // Attach listeners
      this.on("flash_complete", onFlashComplete);
      this.on("flash_error", onFlashError);

      // Emit event để FlashBoard bắt đầu flash
      console.log("Emitting start_flash event to FlashBoard...");
      this.emit("start_flash", { sessionId: this.cachedSessionIdCompile });

      // Timeout sau 60s nếu không nhận được result
      setTimeout(() => {
        this.removeListener("flash_complete", onFlashComplete);
        this.removeListener("flash_error", onFlashError);

        // ✅ Clear sessionId nếu timeout
        this.clearCachedSessionIdCompile();

        reject(
          new Error("Flash timeout - no response from FlashBoard after 60s")
        );
      }, 60000);
    });
  }

  private async handleTerminalRead(
  ): Promise<any> {
    try {
      // Return logs already collected by Terminal during compile
      if (!this.lastCompileLogs || this.lastCompileLogs === "") {
        return {
          message:
            "Không có logs từ lần compile trước. Vui lòng compile file trước.",
          status: "no_logs",
          timestamp: Date.now(),
        };
      }

      // console.log(
      //   `Returning stored compile logs (${this.lastCompileLogs.length} chars)`
      // );

      return {
        message: this.lastCompileLogs,
        status: "success",
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to read terminal logs: ${error}`);
    }
  }

  private async handleSerialRead(params: any): Promise<any> {
    // eslint-disable-next-line prefer-const
    let { port, baudRate, timeout } = params;

    try {
      // FALLBACK Port: agent param → currentSerialPort → error
      if (!port) {
        port = this.currentSerialPort;
      }

      if (!port) {
        throw new Error(
          "Port parameter is required for serial read. Please flash code first."
        );
      }

      // FALLBACK BaudRate: agent param → currentBaudRate → 9600
      if (!baudRate) {
        baudRate = this.currentBaudRate || 9600;
      }

      // CASE 1: Serial already open → Request data from SerialMonitor via event
      if (this.isSerialConnected()) {
        console.log(
          "Serial already connected, requesting logs from SerialMonitor..."
        );
        const logs = await this.getSerialDataFromMonitor();
        return {
          message: logs,
          bytesRead: logs.length,
          timestamp: Date.now(),
        };
      }

      // CASE 2: Serial not open → Connect directly & listen for N seconds
      const logs = await this.connectAndReadSerial(port, baudRate, timeout);
      return {
        message: logs,
        bytesRead: logs.length,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(
        `Failed to read serial port: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private isSerialConnected(): boolean {
    // Will be set to true when SerialMonitor emits connect event
    return this.currentSerialPort !== null;
  }

  private async getSerialDataFromMonitor(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Timeout after 5s if SerialMonitor doesn't respond
      const timeoutId = setTimeout(() => {
        this.removeListener("serial_data_received", listener);
        reject(
          new Error(
            "SerialMonitor did not respond to data request (timeout 5s)"
          )
        );
      }, 5000);

      // Listen for response from SerialMonitor
      const listener = (data: any) => {
        clearTimeout(timeoutId);
        this.removeListener("serial_data_received", listener);
        const logs = Array.isArray(data?.logs)
          ? data.logs.join("\n")
          : String(data?.logs || "");
        resolve(logs);
      };

      this.on("serial_data_received", listener);

      // Request data from SerialMonitor
      console.log("Emitting request_serial_data to SerialMonitor...");
      this.emit("request_serial_data", { timestamp: Date.now() });
    });
  }

  private async connectAndReadSerial(
    port: any,
    baudRate: number,
    timeout: number
  ): Promise<string> {
    const logs: string[] = [];

    try {
      // Use SerialAPI to connect and read for timeout period
      const data = await SerialAPI.readSerialMonitor(port, timeout, baudRate);
      const logString = typeof data === "string" ? data : JSON.stringify(data);

      logs.push(logString);
      return logs.join("\n");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read serial: ${errMsg}`);
    }
  }

  // ============= EVENT EMITTER =============

  /**
   * Get last task result (for FE to retrieve)
   */
  public getLastTaskResult(): ToolResult | null {
    return this.lastTaskResult;
  }

  public setDirectoryHandle(dirHandle: any) {
    this.cachedDirHandle = dirHandle;
    // console.log(`Directory handle cached in ToolGateway`);
  }

  public getDirectoryHandle() {
    return this.cachedDirHandle;
  }

  public setSelectedFile(fileName: string) {
    this.cachedSelectedFile = fileName;
    // console.log(`Selected file cached: ${fileName}`);
  }

  public getSelectedFile() {
    return this.cachedSelectedFile;
  }

  public setCurrentSerialPort(port: any) {
    this.currentSerialPort = port;
  }

  public setCurrentBaudRate(baudRate: number) {
    this.currentBaudRate = baudRate;
    // console.log(`BaudRate updated: ${baudRate} baud`);
  }

  public getCurrentSerialPort() {
    return {
      port: this.currentSerialPort,
      baudRate: this.currentBaudRate,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }
}

// Singleton instance
export const toolGateway = new ToolGateway();

// Expose global methods for IDE or other windows to set selected file
if (typeof window !== "undefined") {
  (window as any).setSelectedFileFromIDE = (fileName: string) => {
    toolGateway.setSelectedFile(fileName);
  };
  (window as any).getSelectedFileFromIDE = () => {
    return toolGateway.getSelectedFile();
  };
}
