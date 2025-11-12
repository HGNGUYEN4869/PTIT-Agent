import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import WebSocket from "ws";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
const COMPILE_API = "http://localhost:2005/h/arduino/compile";
const WS_BASE = "ws://localhost:2005/ws/compile";

// Timeouts and limits
const COMPILE_TIMEOUT = 60000; // 60 seconds
const WS_CONNECT_TIMEOUT = 2000; // 2 seconds wait for WS to connect
const MAX_SERIAL_LINES = 1000; // Limit serial monitor logs

const server = new Server(
  {
    name: "arduino-agent-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_file",
        description: "Read file content from workspace",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Relative path from workspace root",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "Create or update file with content",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative file path" },
            content: { type: "string", description: "File content" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "delete_file",
        description: "Delete a file from workspace",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
      {
        name: "list_files",
        description: "List files in directory",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (optional)" },
          },
        },
      },
      {
        name: "compile_arduino",
        description: "Compile Arduino code and get real-time logs",
        inputSchema: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Path to .ino file relative to workspace",
            },
            board: {
              type: "string",
              description: "Board FQBN (e.g., esp32:esp32:esp32)",
            },
          },
          required: ["file", "board"],
        },
      },
      {
        name: "select_board",
        description: "Set default Arduino board",
        inputSchema: {
          type: "object",
          properties: {
            board: { type: "string", description: "Board FQBN" },
          },
          required: ["board"],
        },
      },
      {
        name: "read_terminal_logs",
        description: "Read compile logs from terminal (WebSocket logs)",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Compile session ID to get logs",
            },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "list_serial_ports",
        description: "List all available serial ports on user's machine",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "read_serial_monitor",
        description: "Read serial output from Arduino board in real-time",
        inputSchema: {
          type: "object",
          properties: {
            port: {
              type: "string",
              description: "Serial port to monitor",
            },
            baudRate: {
              type: "number",
              description: "Baud rate (default: 115200)",
            },
            duration: {
              type: "number",
              description: "Duration to monitor in seconds (default: 10)",
            },
          },
          required: ["port"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "read_file": {
        const { path: filePath } = args as { path: string };
        const fullPath = path.join(WORKSPACE_ROOT, filePath);
        const content = await fs.readFile(fullPath, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "write_file": {
        const { path: filePath, content: fileContent } = args as {
          path: string;
          content: string;
        };
        const fullPath = path.join(WORKSPACE_ROOT, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileContent, "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `File created: ${filePath}`,
            },
          ],
        };
      }

      case "delete_file": {
        const { path: filePath } = args as { path: string };
        const fullPath = path.join(WORKSPACE_ROOT, filePath);
        await fs.unlink(fullPath);
        return {
          content: [
            {
              type: "text",
              text: `File deleted: ${filePath}`,
            },
          ],
        };
      }

      case "list_files": {
        const { path: dirPath } = args as { path?: string };
        const fullDirPath = dirPath
          ? path.join(WORKSPACE_ROOT, dirPath)
          : WORKSPACE_ROOT;
        const entries = await fs.readdir(fullDirPath, { withFileTypes: true });
        const files = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(files, null, 2),
            },
          ],
        };
      }

      case "compile_arduino": {
        const { file, board } = args as { file: string; board: string };
        const filePath = path.join(WORKSPACE_ROOT, file);
        const fileContent = await fs.readFile(filePath, "utf-8");

        const sessionId = `mcp-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

        const logs: string[] = [];

        const wsPromise = new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(`${WS_BASE}/${sessionId}`);

          ws.on("open", () => {
            console.log("WebSocket connected for compile logs");
          });

          ws.on("message", (data) => {
            try {
              // Parse JSON message from Spring Boot
              const logMessage = JSON.parse(data.toString());

              // Format: { message: string, timestamp: string, level: string }
              const { message, level } = logMessage;

              // Add timestamp and level to log
              const formattedLog = `[${level}] ${message}`;
              logs.push(formattedLog);

              // Auto close on completion signals
              if (
                level === "SUCCESS" ||
                message.toLowerCase().includes("done")
              ) {
                console.log("Compile completed, closing WebSocket");
                setTimeout(() => ws.close(), 500); // Small delay to ensure all logs received
              }
            } catch {
              // Fallback: if not JSON, push raw message
              console.warn("Non-JSON message received:", data.toString());
              logs.push(data.toString());
            }
          });

          ws.on("error", (error) => {
            console.error("WebSocket error:", error);
            reject(error);
          });

          ws.on("close", () => {
            console.log("WebSocket closed, total logs:", logs.length);
            resolve();
          });

          // Timeout fallback
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log("Compile timeout, closing WebSocket");
              ws.close();
            }
            resolve();
          }, COMPILE_TIMEOUT);
        });

        await new Promise((resolve) => setTimeout(resolve, WS_CONNECT_TIMEOUT));

        const FormData = (await import("form-data")).default;
        const formData = new FormData();
        formData.append("file", Buffer.from(fileContent), {
          filename: path.basename(file),
          contentType: "text/plain",
        });
        formData.append("board", board);
        formData.append("sessionId", sessionId);

        try {
          const response = await axios.post(COMPILE_API, formData, {
            headers: formData.getHeaders(),
            timeout: COMPILE_TIMEOUT,
          });

          await wsPromise;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: response.data.success || true,
                    sessionId: sessionId,
                    logs: logs.join("\n"),
                    firmware: response.data.firmware,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          await wsPromise;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error:
                      error instanceof Error ? error.message : String(error),
                    logs: logs.join("\n"),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      case "select_board": {
        const { board } = args as { board: string };
        return {
          content: [
            {
              type: "text",
              text: `Board selected: ${board}`,
            },
          ],
        };
      }

      case "read_terminal_logs": {
        const { sessionId } = args as { sessionId: string };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message:
                  "Terminal logs are streamed via WebSocket during compile",
                sessionId: sessionId,
                wsUrl: `${WS_BASE}/${sessionId}`,
              }),
            },
          ],
        };
      }

      case "list_serial_ports": {
        try {
          const ports = await SerialPort.list();
          const portList = ports.map((port) => ({
            path: port.path,
            manufacturer: port.manufacturer,
            serialNumber: port.serialNumber,
            vendorId: port.vendorId,
            productId: port.productId,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(portList, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error listing serial ports: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }

      case "read_serial_monitor": {
        const {
          port: portPath,
          baudRate: inputBaudRate,
          duration: inputDuration,
        } = args as {
          port: string;
          baudRate?: number;
          duration?: number;
        };
        const baudRate = inputBaudRate || 115200;
        const duration = inputDuration || 10;

        try {
          const serialLogs: string[] = [];

          await new Promise<void>((resolve, reject) => {
            const port = new SerialPort({
              path: portPath,
              baudRate: baudRate,
            });

            const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

            parser.on("data", (line: string) => {
              const timestamp = new Date().toISOString();
              serialLogs.push(`[${timestamp}] ${line}`);

              // Giới hạn số dòng log để tránh memory leak
              if (serialLogs.length > MAX_SERIAL_LINES) {
                serialLogs.shift();
              }
            });

            port.on("error", (err) => {
              reject(err);
            });

            // Đọc trong khoảng thời gian nhất định
            setTimeout(() => {
              port.close((err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }, duration * 1000);
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    port: portPath,
                    baudRate: baudRate,
                    duration: duration,
                    logs: serialLogs.join("\n"),
                    totalLines: serialLogs.length,
                    truncated: serialLogs.length >= MAX_SERIAL_LINES,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    port: portPath,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Arduino MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
