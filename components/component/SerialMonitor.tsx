"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Terminal } from "../ui/terminal";
import { Send, Power, Trash2 } from "lucide-react";

type SerialMonitorProps = {
  serialPort: SerialPort | null;
};

export function SerialMonitor({ serialPort }: SerialMonitorProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(115200);
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
          console.log("Port đang mở, đóng lại trước...");

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
          console.log("Port đã đóng");
        }

        // Đợi một chút để port được giải phóng hoàn toàn
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (closeError) {
        console.warn("Lỗi khi đóng port (có thể đã đóng rồi):", closeError);
        // Không throw error, tiếp tục mở port
      }

      // Mở port với baudRate
      console.log(`Đang mở port với baudRate ${baudRate}...`);
      await serialPort.open({ baudRate });
      setIsConnected(true);
      toast.success(`Đã kết nối Serial Monitor (${baudRate} baud)`);

      // Bắt đầu đọc data
      startReading();
    } catch (error: any) {
      toast.error(`Lỗi kết nối: ${error.message}`);
      console.error("Serial connect error:", error);
      setIsConnected(false);
    }
  };

  // Đọc data từ serial port
  const startReading = async () => {
    if (!serialPort || !serialPort.readable) return;

    const decoder = new TextDecoder();
    readerRef.current = serialPort.readable.getReader();

    try {
      while (true) {
        const { value, done } = await readerRef.current.read();
        if (done) {
          console.log("Serial reader closed");
          break;
        }

        if (value) {
          const text = decoder.decode(value);
          setLogs((prev) => [...prev, text]);
        }
      }
    } catch (error: any) {
      console.error("Serial read error:", error);
      if (!error.message.includes("device has been lost")) {
        toast.error(`Lỗi đọc dữ liệu: ${error.message}`);
      }
    } finally {
      readerRef.current?.releaseLock();
    }
  };

  // Gửi data tới Arduino
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
    } catch (error: any) {
      toast.error(`Lỗi gửi dữ liệu: ${error.message}`);
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
      toast.info("Đã ngắt kết nối Serial Monitor");
    } catch (error: any) {
      console.error("Disconnect error:", error);
    }
  };

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-800">
        <h3 className="text-sm font-semibold text-white">📡 Serial Monitor</h3>
        <div className="flex items-center gap-2">
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
            className="text-xs bg-gray-700 text-white px-2 py-1 rounded border border-gray-600"
          >
            <option value={9600}>9600</option>
            <option value={115200}>115200</option>
            <option value={57600}>57600</option>
            <option value={38400}>38400</option>
          </select>
          
          {!isConnected ? (
            <Button size="sm" onClick={connectSerial} className="gap-1">
              <Power className="w-3 h-3" />
              Kết nối
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={disconnect}
              variant="destructive"
              className="gap-1"
            >
              <Power className="w-3 h-3" />
              Ngắt
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
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap wrap-break-word">
              {log}
            </div>
          ))
        )}
      </Terminal>
    </div>
  );
}
