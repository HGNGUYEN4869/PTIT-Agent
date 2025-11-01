"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  downloadUnoFirmware,
  downloadEsp32Firmware,
  downloadStm32Firmware,
} from "@/app/api/arduinoCompile";
import { ArduinoFlasher, SerialPort } from "@/lib/ArduinoFlasher";
import { ESP32Flasher } from "@/lib/ESP32Flasher";

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

  /**Tự nhận diện board theo vendorId */
  async function detectBoard(): Promise<{ type: string; port?: SerialPort }> {
    try {
      // Kiểm tra DFU (STM32)
      const devices = await navigator.usb.getDevices();
      if (devices.some((d) => d.vendorId === 0x0483)) return { type: "STM32" };
    } catch {}

    // Serial (UNO, ESP32, )
    try {
      const port = (await navigator.serial.requestPort()) as any as SerialPort;

      //Đảm bảo port được đóng hoàn toàn trước khi detect
      if (port.readable || port.writable) {
        try {
          console.log("Port đang mở, đóng lại để detect...");

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
          console.log("Port đã đóng");

          // Đợi port được giải phóng hoàn toàn
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (closeError) {
          console.warn("Lỗi đóng port (port có thể đã đóng):", closeError);
          // Vẫn tiếp tục, vì port có thể đã đóng rồi
        }
      }

      //Giờ mở port để detect board type
      console.log("Đang mở port để detect board...");
      await port.open({ baudRate: 115200 });

      const info = port.getInfo();
      const vid = info.usbVendorId;

      console.log(`Detected VID: 0x${vid?.toString(16)}`);

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
    } catch (error: any) {
      console.error("Detect board error:", error);
      toast.error(`Không tìm thấy board: ${error.message}`);
      throw new Error("Không tìm thấy board nào!");
    }
  }

  /** Nạp code cho Arduino UNO */
  async function flashUNO(port: SerialPort) {
    if (!sessionId) {
      toast.error("Thiếu sessionId! Vui lòng compile code trước.");
      throw new Error("Missing sessionId");
    }

    try {
      // 1. Download file .hex từ backend
      toast.info("Đang tải firmware...");
      const blob = await downloadUnoFirmware(sessionId);
      const hexContent = await blob.text();

      console.log("Hex file downloaded, size:", hexContent.length, "bytes");

      // 2. Tạo Arduino Flasher với progress callback
      const flasher = new ArduinoFlasher(port, (progress) => {
        console.log(`Progress: ${progress.percentage}% - ${progress.message}`);
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
    } catch (error: any) {
      console.error("Flash UNO error:", error);
      toast.error(`Lỗi nạp code: ${error.message || error}`);
      throw error;
    }
  }

  /**Nạp code cho ESP32/ESP8266 */
  async function flashESP32(port: SerialPort) {
    if (!sessionId) {
      toast.error("Vui lòng compile code trước.");
      throw new Error("Missing sessionId");
    }

    try {
      // 1. Download firmware binary từ backend
      toast.info("Đang tải firmware cho ESP32/ESP8266...");
      const blob = await downloadEsp32Firmware(sessionId);
      const binData = await blob.arrayBuffer();

      console.log(
        "ESP32/ESP8266 firmware downloaded, size:",
        binData.byteLength,
        "bytes"
      );

      // 2. Tạo ESP32 Flasher với progress callback
      const flasher = new ESP32Flasher(port, (progress) => {
        console.log(
          `ESP32/ESP8266 Progress: ${progress.percentage}% - ${progress.message}`
        );
        toast.info(`${progress.message} (${progress.percentage}%)`);
      });

      // 3. Nạp firmware vào ESP32/ESP8266
      // ESP8266: offset 0x0 (default)
      // ESP32: offset 0x10000 (app partition)
      // FlashOffset sẽ tự động được xử lý trong ESP32Flasher dựa vào chip detect
      await flasher.flash(binData); // Sử dụng default offset 0x0

      toast.success("Nạp code thành công! ESP32/ESP8266 đang chạy firmware mới.");

      // 4. Callback để IDECode biết flash xong
      if (onFlashComplete) {
        // Đợi ESP32 reset và khởi động code mới
        await new Promise((resolve) => setTimeout(resolve, 2000));
        onFlashComplete(port);
      }
    } catch (error: any) {
      console.error("Flash ESP32/ESP8266 error:", error);
      toast.error(`Lỗi nạp ESP32/ESP8266: ${error.message || error}`);
      throw error;
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

      // @ts-ignore: WebUSB experimental
      const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: 0x0483 }],
      });
      await (device as any).open();
      if ((device as any).configuration === null)
        await (device as any).selectConfiguration(1);
      await (device as any).claimInterface(0);

      // Gửi firmware qua endpoint 0
      await (device as any).transferOut(0x01, new Uint8Array(firmware));
      await (device as any).close();
      toast.success("Nạp hoàn tất cho STM32!");
    } catch (error: any) {
      toast.error(`Lỗi tải firmware: ${error.message}`);
      throw error;
    }
  }

  /** Bắt đầu quy trình nạp */
  async function handleFlash() {
    setIsFlashing(true);
    toast.info("Đang dò thiết bị");
    try {
      let board: { type: string; port?: SerialPort };

      // Nếu đã có boardType từ compile step, ưu tiên dùng nó
      if (boardType) {
        if (boardType === "STM32") {
          board = { type: "STM32" };
        } else {
          // UNO hoặc ESP32 cần serial port
          const port = (await navigator.serial.requestPort()) as any as SerialPort;
          board = { type: boardType, port };
        }
        toast.success(`Sử dụng board đã chọn: ${boardType}`);
      } else {
        // Fallback: auto-detect nếu không có boardType
        board = await detectBoard();
        toast.success(`Phát hiện board: ${board.type}`);
      }

      if (board.type === "UNO" && board.port) await flashUNO(board.port);
      else if (board.type === "ESP8266" && board.port)
        await flashESP32(board.port); // ESP8266 dùng cùng flasher với ESP32
      else if (board.type === "ESP32" && board.port)
        await flashESP32(board.port);
      else if (board.type === "STM32") await flashSTM32();
      else toast.error("Board không được hỗ trợ nạp tự động!");
    } catch (err: any) {
      toast.error(`Lỗi nạp code: ${err.message}`);
    } finally {
      setIsFlashing(false);
    }
  }

  return (
    <div>
      <Button
        disabled={isFlashing || !sessionId}
        onClick={handleFlash}
        size="sm"
        title={!sessionId ? "Vui lòng compile code trước" : ""}
      >
        {isFlashing ? "Đang nạp..." : "Nạp Code"}
      </Button>
    </div>
  );
}
