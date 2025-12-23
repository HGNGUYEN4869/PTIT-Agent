"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  downloadUnoFirmware,
  downloadEsp32Firmware,
  downloadStm32Firmware,
} from "@/app/api/arduinoCompile";
import { ArduinoFlasher, SerialPort } from "@/lib/ArduinoFlasher";
import { ESP32Flasher } from "@/lib/ESP32Flasher";
import { motion } from "framer-motion";
import { toolGateway } from "@/lib/toolGateway";

type FlashAllBoardsProps = {
  sessionId?: string; // Session ID từ compile step
  boardType?: string; // Board type đã chọn khi compile: "UNO" | "ESP8266" | "ESP32" | "STM32"
  onFlashComplete?: (port: SerialPort) => void; // Callback sau khi flash xong
};

export default function FlashAllBoards({
  sessionId,
  boardType,
  onFlashComplete,
}: FlashAllBoardsProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const [hasFlashed, setHasFlashed] = useState(false); // Disable after first successful flash

  //  Listen for "start_flash" event from ToolGateway (TOOL_UPLOAD_FIRMWARE)
  useEffect(() => {
    toolGateway.on("start_flash", handleFlash);

    return () => {
      toolGateway.removeListener("start_flash", handleFlash);
    };
  }, [boardType]);

  // Reset hasFlashed when sessionId changes (new compile)
  useEffect(() => {
    setHasFlashed(false);
  }, [sessionId]);

  // Also reset hasFlashed when Agent starts compile
  useEffect(() => {
    const handleCompileStarted = () => {
      setHasFlashed(false);
    };

    toolGateway.on("compile_started", handleCompileStarted);

    return () => {
      toolGateway.removeListener("compile_started", handleCompileStarted);
    };
  }, []);

  /**Tự nhận diện board theo vendorId */
  async function detectBoard(): Promise<{ type: string; port?: SerialPort }> {
    try {
      // Kiểm tra DFU (STM32)
      const devices = await navigator.usb.getDevices();
      if (devices.some((d) => d.vendorId === 0x0483)) return { type: "STM32" };
    } catch {}

    // Serial (UNO, ESP32, )
    try {
      const port = (await navigator.serial.requestPort()) as SerialPort;

      //Đảm bảo port được đóng hoàn toàn trước khi detect
      if (port.readable || port.writable) {
        try {
          // console.log("Port đang mở, đóng lại để detect...");

          // QUAN TRỌNG: Phải release reader/writer trước khi đóng port
          if (port.readable?.locked) {
            const reader = port.readable.getReader();
            reader.releaseLock();
          }
          if (port.writable?.locked) {
            const writer = port.writable.getWriter();
            writer.releaseLock();
          }

          await port.close();
          // console.log("Port đã đóng");

          // Đợi port được giải phóng hoàn toàn
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (closeError) {
          console.warn("Lỗi đóng port (port có thể đã đóng):", closeError);
          // Vẫn tiếp tục, vì port có thể đã đóng rồi
        }
      }

      //Giờ mở port để detect board type
      await port.open({ baudRate: 115200 });

      const info = port.getInfo();
      const vid = info.usbVendorId;

      // console.log(`Detected VID: 0x${vid?.toString(16)}`);

      // Detect board type
      let boardType: string;

      // Arduino UNO official (0x2341)
      if (vid === 0x2341) {
        boardType = "UNO"; // Arduino official
      }
      // CH340 chip (0x1a86) - có thể là Arduino, ESP8266, hoặc ESP32
      // Mặc định ESP8266 (phổ biến hơn Arduino clone)
      else if (vid === 0x1a86) {
        boardType = "ESP8266"; // Default cho CH340 clone
      }
      // ESP32 official (0x303a) hoặc CP2102 (0x10c4)
      else if (vid === 0x303a || vid === 0x10c4) {
        boardType = "ESP32";
      } else {
        boardType = "UNKNOWN";
      }

      //Đóng port sau khi detect xong, ArduinoFlasher sẽ tự mở lại
      await port.close();
      await new Promise((resolve) => setTimeout(resolve, 200));

      return { type: boardType, port };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(`Không tìm thấy board: ${err.message}`);
      throw new Error("Không tìm thấy board nào!");
    }
  }

  /** Nạp code cho Arduino UNO */
  async function flashUNO(port: SerialPort, sessionId?: string) {
    if (!sessionId) {
      toast.error("Thiếu sessionId! Vui lòng compile code trước.");
      throw new Error("Missing sessionId");
    }

    try {
      // 1. Download file .hex từ backend
      toast.info("Đang tải firmware...");
      const blob = await downloadUnoFirmware(sessionId);
      const hexContent = await blob.text();

      // 2. Tạo Arduino Flasher với progress callback
      const flasher = new ArduinoFlasher(port, (progress) => {
        toast.info(`${progress.message} (${progress.percentage}%)`);
      });

      // 3. Nạp code với callback khi cần nhấn nút reset
      const onNeedManualReset = () => {
        toast.warning("NHẤN NÚT RESET TRÊN ARDUINO NGAY BÂY GIỜ!", {
          duration: 3000,
          style: {
            fontSize: "18px",
            fontWeight: "bold",
            backgroundColor: "#ff9800",
            color: "white",
          },
        });
      };

      const flashPromise = flasher.flash(hexContent, onNeedManualReset);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Flash timeout after 30s")), 30000)
      );

      await Promise.race([flashPromise, timeoutPromise]);

      toast.success("Nạp code thành công! Code đang chạy trên Arduino.");

      // 5. Callback để IDECode biết flash xong và có thể mở Serial Monitor
      if (onFlashComplete) {
        // Đợi Arduino reset và khởi động code mới
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // SerialMonitor sẽ tự mở khi user nhấn "Kết nối"
        // Port đã được đóng bởi ArduinoFlasher, SerialMonitor sẽ mở lại với baudRate riêng

        onFlashComplete(port);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // console.error("Flash UNO error:", err);
      toast.error(`Lỗi nạp code: ${err.message || String(err)}`);
      throw error;
    }
  }

  /**Nạp code cho ESP32/ESP8266 */
  async function flashESP32(port: SerialPort, sessionId?: string) {
    if (!sessionId) {
      toast.error("Vui lòng compile code trước.");
      throw new Error("Missing sessionId");
    }

    try {
      // 1. Download firmware binary từ backend
      toast.info("Đang tải firmware cho ESP32/ESP8266...");
      const blob = await downloadEsp32Firmware(sessionId);
      const binData = await blob.arrayBuffer();

      // console.log(
      //   "ESP32/ESP8266 firmware downloaded, size:",
      //   binData.byteLength,
      //   "bytes"
      // );

      // 2. Tạo ESP32 Flasher với progress callback
      const flasher = new ESP32Flasher(port, (progress) => {
        // console.log(
        //   `ESP32/ESP8266 Progress: ${progress.percentage}% - ${progress.message}`
        // );
        toast.info(`${progress.message} (${progress.percentage}%)`);
      });

      // 3. Nạp firmware vào ESP32/ESP8266
      // ESP8266: offset 0x0 (default)
      // ESP32: offset 0x10000 (app partition)
      // FlashOffset sẽ tự động được xử lý trong ESP32Flasher dựa vào chip detect
      await flasher.flash(binData); // Sử dụng default offset 0x0

      toast.success(
        "Nạp code thành công! ESP32/ESP8266 đang chạy firmware mới."
      );

      // 4. Callback để IDECode biết flash xong
      if (onFlashComplete) {
        // Đợi ESP32 reset và khởi động code mới
        await new Promise((resolve) => setTimeout(resolve, 2000));
        onFlashComplete(port);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // console.error("Flash ESP32/ESP8266 error:", err);

      // Hiển thị hướng dẫn chi tiết dựa vào loại lỗi
      const errorMsg = err.message || err.toString();

      if (errorMsg.includes("Failed to communicate with the flash chip")) {
        ESP32Flasher.showFlashChipTroubleshooting();
      } else if (errorMsg.includes("No serial data received")) {
        toast.error("Không nhận được dữ liệu từ ESP!", {
          duration: 10000,
        });
        setTimeout(() => {
          toast.info("Hãy vào bootloader mode thủ công và thử lại", {
            duration: 10000,
          });
        }, 1000);
      } else {
        toast.error(`Lỗi nạp ESP32/ESP8266: ${errorMsg.substring(0, 100)}`);
      }

      throw error;
    } finally {
      // QUAN TRỌNG: Đóng port để giải phóng khi lỗi hoặc thành công
      try {
        // Release reader/writer nếu đang locked
        if (port.readable?.locked) {
          const reader = port.readable.getReader();
          reader.releaseLock();
        }
        if (port.writable?.locked) {
          const writer = port.writable.getWriter();
          writer.releaseLock();
        }

        // Đóng port nếu đang mở
        if (port.readable || port.writable) {
          await port.close();
          // console.log("Port đã được đóng và giải phóng");
        }
      } catch (closeErr) {
        // console.warn("Không thể đóng port (có thể đã đóng rồi):", closeErr);
      }
    }
  }

  /**Nạp code cho STM32 (DFU mode) */
  async function flashSTM32() {
    toast.info("Đang tải firmware cho STM32...");

    // Download firmware từ backend API
    if (!sessionId) {
      toast.error("Thiếu sessionId! Vui lòng compile code trước.");
      throw new Error("Missing sessionId");
    }

    try {
      const blob = await downloadStm32Firmware(sessionId);
      const firmware = await blob.arrayBuffer();

      toast.info("STM32 - Đang nạp firmware mode DFU...");

      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }],
      });

      const usbDevice = device as USBDevice & {
        open: () => Promise<void>;
        configuration: unknown;
        selectConfiguration: (configurationValue: number) => Promise<void>;
        claimInterface: (interfaceNumber: number) => Promise<void>;
        transferOut: (
          endpointNumber: number,
          data: Uint8Array
        ) => Promise<unknown>;
        close: () => Promise<void>;
      };

      await usbDevice.open();
      if (usbDevice.configuration === null)
        await usbDevice.selectConfiguration(1);
      await usbDevice.claimInterface(0);

      // Gửi firmware qua endpoint 0
      await usbDevice.transferOut(0x01, new Uint8Array(firmware));
      await usbDevice.close();
      toast.success("Nạp hoàn tất cho STM32!");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(`Lỗi tải firmware: ${err.message}`);
      throw error;
    }
  }

  /** Bắt đầu quy trình nạp */
  async function handleFlash(event?: { sessionId: string }) {
    // sessionId từ event → props → toolGateway cache
    let flashSessionId = event?.sessionId || sessionId;

    // Fallback: Lấy từ toolGateway nếu không có từ props/event (Agent compile + User flash)
    if (!flashSessionId) {
      flashSessionId = toolGateway.getCachedSessionIdCompile();
    }

    if (!flashSessionId) {
      toast.error("Thiếu sessionId! Vui lòng compile code trước.");
      return;
    }
    setIsFlashing(true);
    toast.info("Đang dò thiết bị");
    try {
      let board: { type: string; port?: SerialPort };

      // Nếu đã có boardType từ compile step, ưu tiên dùng nó
      if (boardType && flashSessionId) {
        if (boardType === "STM32") {
          board = { type: "STM32" };
        } else {
          if (boardType === "ESP32" || boardType === "ESP8266") {
            ESP32Flasher.enterBootloaderMode();
          }
          // UNO hoặc ESP32 cần serial port
          const port = (await navigator.serial.requestPort()) as SerialPort;
          board = { type: boardType, port };
        }
      } else {
        // Fallback: auto-detect nếu không có boardType
        board = await detectBoard();
        toast.success(`Phát hiện board: ${board.type}`);
      }

      if (board.type === "UNO" && board.port)
        await flashUNO(board.port, flashSessionId);
      else if (board.type === "ESP8266" && board.port)
        await flashESP32(board.port, flashSessionId);
      // ESP8266 dùng cùng flasher với ESP32
      else if (board.type === "ESP32" && board.port)
        await flashESP32(board.port, flashSessionId);
      else if (board.type === "STM32") await flashSTM32();
      else throw new Error("Board không được hỗ trợ nạp tự động!");

      //  EMIT SUCCESS EVENT to ToolGateway
      toolGateway.emit("flash_complete", {
        boardType: board.type,
        port: board.port,
        flashSessionId,
        timestamp: Date.now(),
      });

      //  Also call callback for IDECode if provided (backward compatibility)
      if (onFlashComplete && board.port) {
        onFlashComplete(board.port);
      }

      // Mark as flashed - disable button until new compile
      setHasFlashed(true);

      // Clear sessionId từ toolGateway sau khi flash thành công
      // để tránh bị dùng lại cho session tiếp theo
      toolGateway.clearCachedSessionIdCompile();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error(`Lỗi nạp code: ${error.message}`);
      toolGateway.emit("flash_error", {
        message: error.message,
        flashSessionId,
        timestamp: Date.now(),
      });
      // Vẫn clear sessionId ngay cả khi lỗi để không bị stuck
      toolGateway.clearCachedSessionIdCompile();
    } finally {
      setIsFlashing(false);
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <Button
        disabled={isFlashing || !sessionId || hasFlashed}
        onClick={() => handleFlash()}
        size="sm"
        title={
          hasFlashed
            ? "Đã nạp xong! Compile code mới để nạp lại"
            : !sessionId
            ? "Vui lòng compile code trước"
            : ""
        }
        className="bg-[#252525] hover:bg-[#313131] text-white"
      >
        {isFlashing ? (
          <>
            <span>Đang nạp</span>
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
          "Nạp Code"
        )}
      </Button>
    </div>
  );
}
