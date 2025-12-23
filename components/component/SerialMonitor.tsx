"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Terminal } from "../ui/terminal";
import { Trash2, Wifi, WifiOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { toolGateway } from "@/lib/toolGateway";

type SerialMonitorProps = {
  serialPort: SerialPort | null;
};

export function SerialMonitor({ serialPort }: SerialMonitorProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null
  );
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );

  // Mở port và bắt đầu đọc data
  const connectSerial = async () => {
    if (!serialPort) {
      toast.error("Không có port nào được chọn. Vui lòng flash code trước.");
      return;
    }

    try {
      //Luôn đóng port trước khi mở lại (đảm bảo clean state)
      try {
        if (serialPort.readable || serialPort.writable) {
          // Release reader/writer nếu có
          if (serialPort.readable?.locked) {
            const reader = serialPort.readable.getReader();
            reader.releaseLock();
          }
          if (serialPort.writable?.locked) {
            const writer = serialPort.writable.getWriter();
            writer.releaseLock();
          }

          await serialPort.close();
        }

        // Đợi một chút để port được giải phóng hoàn toàn
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {
        // Port có thể đã đóng rồi, tiếp tục mở port
      }

      await serialPort.open({ baudRate });

      // Tắt DTR/RTS signals để tránh ESP32 bị auto-reset
      try {
        const portWithSignals = serialPort as SerialPort & {
          setSignals: (signals: {
            dataTerminalReady?: boolean;
            requestToSend?: boolean;
          }) => Promise<void>;
        };
        await portWithSignals.setSignals({
          dataTerminalReady: false, // DTR = LOW
          requestToSend: false, // RTS = LOW
        });
      } catch {
        // Board không hỗ trợ signal control, bỏ qua
      }

      setIsConnected(true);
      toast.success(`Đã kết nối Serial Monitor (${baudRate} baud)`);

      // Bắt đầu đọc data
      startReading();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(`Lỗi kết nối: ${err.message}`);
      setIsConnected(false);
    }
  };

  // Đọc data từ serial port
  const startReading = async () => {
    if (!serialPort || !serialPort.readable) return;

    const decoder = new TextDecoder();
    readerRef.current = serialPort.readable.getReader();
    let buffer = ""; // Accumulate partial data

    try {
      while (true) {
        const { value, done } = await readerRef.current.read();
        if (done) break;

        if (value) {
          buffer += decoder.decode(value);

          // Split by newline & add complete lines only
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          // Add complete lines to logs
          const completeLines = lines.filter((l) => l.trim().length > 0);
          if (completeLines.length > 0) {
            setLogs((prev) => [...prev, ...completeLines]);
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!err.message.includes("device has been lost")) {
        toast.error(`Lỗi đọc dữ liệu: ${err.message}`);
      }
    } finally {
      readerRef.current?.releaseLock();
    }
  };

  // Gửi data tới Arduino (hiện tại chưa sử dụng)
  const sendData = async () => {
    if (!serialPort || !serialPort.writable || !input.trim()) return;

    try {
      if (!writerRef.current) {
        writerRef.current = serialPort.writable.getWriter();
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(input + "\n");
      await writerRef.current.write(data);

      setLogs((prev) => [...prev, `> ${input}\n`]);
      setInput("");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(`Lỗi gửi dữ liệu: ${err.message}`);
      writerRef.current?.releaseLock();
      writerRef.current = null;
    }
  };

  // Ngắt kết nối
  const disconnect = async () => {
    try {
      // Release reader/writer
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }

      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current.releaseLock();
        writerRef.current = null;
      }

      // Close port
      if (serialPort && (serialPort.readable || serialPort.writable)) {
        await serialPort.close();
      }

      setIsConnected(false);
    } catch {
      toast.error("Lỗi khi ngắt kết nối");
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  // Setup listener for ToolGateway's request_serial_data event
  useEffect(() => {
    const handleRequestSerialData = () => {
      // Emit current logs to ToolGateway
      toolGateway.emit("serial_data_received", {
        logs: logs,
        isConnected: isConnected,
        timestamp: Date.now(),
      });
    };

    toolGateway.on("request_serial_data", handleRequestSerialData);

    return () => {
      toolGateway.removeListener(
        "request_serial_data",
        handleRequestSerialData
      );
    };
  }, [logs, isConnected]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-t border-gray-700 bg-[#1e1e1e]">
        <div className="flex items-center gap-2 w-full justify-end">
          <Select
            value={baudRate.toString()}
            onValueChange={(value) => {
              const newBaudRate = Number(value);
              setBaudRate(newBaudRate);
              // Emit baudRate to toolGateway whenever user changes it
              toolGateway.setCurrentBaudRate(newBaudRate);
            }}
            disabled={isConnected}
          >
            <SelectTrigger
              size="sm"
              className="w-fit bg-[#252525] border-[#444444] text-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2400">2400</SelectItem>
              <SelectItem value="4800">4800</SelectItem>
              <SelectItem value="9600">9600</SelectItem>
              <SelectItem value="38400">38400</SelectItem>
              <SelectItem value="57600">57600</SelectItem>
              <SelectItem value="115200">115200</SelectItem>
              <SelectItem value="230400">230400</SelectItem>
              <SelectItem value="460800">460800</SelectItem>
              <SelectItem value="921600">921600</SelectItem>
            </SelectContent>
          </Select>

          {!isConnected ? (
            <Button
              size="sm"
              onClick={connectSerial}
              className="gap-1 text-green-500"
            >
              <Wifi className="w-3 h-3" />
              Kết nối
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={disconnect}
              className="gap-1 text-red-500"
            >
              <WifiOff className="w-3 h-3" /> Ngắt
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setLogs([])}
            className="gap-1"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Terminal logs */}
      <Terminal className="bg-[#1e1e1e] text-white font-mono h-[300px] overflow-y-auto w-full">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            {isConnected
              ? "Đang chờ dữ liệu từ Arduino..."
              : "Nhấn 'Kết nối' để bắt đầu"}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="bg-[#1e1e1e] text-white font-mono h-[266px] overflow-y-auto w-full none-scrollbar -mr-8"
          >
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap wrap-break-words">
                {log}
              </div>
            ))}
          </div>
        )}
      </Terminal>
    </div>
  );
}
