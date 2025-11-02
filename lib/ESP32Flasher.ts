/**
 * ESP32/ESP8266 Flasher - Sử dụng esptool-js protocol
 * Hỗ trợ ESP8266, ESP32, ESP32-S2, ESP32-S3, ESP32-C3
 *
 * Flash addresses:
 * - ESP8266: 0x0 (default)
 * - ESP32: 0x10000 (app partition)
 */

import { toast } from "sonner";
import { ESPLoader, Transport } from "esptool-js";

interface FlashProgress {
  percentage: number;
  message: string;
}

interface ESP32Config {
  name: string;
  baudRate: number;
  flashSize:
    | "keep"
    | "256KB"
    | "512KB"
    | "1MB"
    | "2MB"
    | "4MB"
    | "8MB"
    | "16MB";
}

export class ESP32Flasher {
  private port: SerialPort;
  private onProgress?: (progress: FlashProgress) => void;
  private config: ESP32Config;
  private esploader?: ESPLoader;
  private transport?: Transport; // Lưu transport để disconnect sau

  constructor(
    port: SerialPort,
    onProgress?: (progress: FlashProgress) => void,
    config?: Partial<ESP32Config>
  ) {
    this.port = port;
    this.onProgress = onProgress;
    this.config = {
      name: config?.name ?? "ESP32",
      baudRate: config?.baudRate ?? 115200,
      flashSize: (config?.flashSize ?? "4MB") as ESP32Config["flashSize"],
    };
  }

  /**
   * Flash firmware binary to ESP32/ESP8266
   * @param binData Binary firmware data from backend
   * @param flashOffset Offset address (default 0x0 for ESP8266, 0x10000 for ESP32)
   */
  async flash(binData: ArrayBuffer, flashOffset: number = 0x0): Promise<void> {
    try {
      this.onProgress?.({
        percentage: 0,
        message: "Khởi tạo kết nối với ESP32...",
      });

      // Initialize transport
      this.transport = new Transport(this.port, true);

      // Initialize ESPLoader with all required options
      this.esploader = new ESPLoader({
        transport: this.transport,
        baudrate: this.config.baudRate,
        flashSize: this.config.flashSize,
        terminal: {
          clean() {},
          writeLine(text: string) {
            console.log(text);
          },
          write(text: string) {
            console.log(text);
          },
        },
      });

      // Connect to ESP32 bootloader và detect chip
      this.onProgress?.({
        percentage: 10,
        message: "Đang kết nối với bootloader...",
      });

      const chipName = await this.esploader.main();
      console.log("Connected to:", chipName);

      this.onProgress?.({
        percentage: 20,
        message: `Đã kết nối với ${chipName}`,
      });

      // KHÔNG đổi baud rate cho ESP8266 vì thường gây lỗi
      // Chỉ đổi cho ESP32
      if (chipName.includes("ESP32") && !chipName.includes("ESP8266")) {
        try {
          await this.esploader.changeBaud();
        } catch (err) {
          toast.warning("Không thể thay đổi baud rate, sẽ sử dụng mặc định");
        }
      } else {
        toast.info("Giữ nguyên baud rate mặc định cho ESP8266");
      }

      this.onProgress?.({
        percentage: 30,
        message: "Bắt đầu ghi firmware...",
      });

      // Convert ArrayBuffer to binary string (each char = 1 byte)
      const uint8Data = new Uint8Array(binData);
      let binaryString = "";
      for (let i = 0; i < uint8Data.length; i++) {
        binaryString += String.fromCharCode(uint8Data[i]);
      }

      // esptool-js writeFlash expects FlashOptions
      // Sử dụng flashMode phù hợp cho từng chip
      const flashMode = chipName.includes("ESP8266") ? "qio" : "dio";
      const flashFreq = chipName.includes("ESP8266") ? "40m" : "40m";

      await this.esploader.writeFlash({
        fileArray: [
          {
            data: binaryString, // esptool-js expects binary string (not UTF-8)
            address: flashOffset,
          },
        ],
        flashMode: flashMode,
        flashFreq: flashFreq,
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const percentage = 30 + Math.floor((written / total) * 60);
          this.onProgress?.({
            percentage,
            message: `Đang ghi... ${written}/${total} bytes`,
          });
        },
      });

      this.onProgress?.({
        percentage: 95,
        message: "Hoàn tất, đang reset ESP...",
      });

      // Reset ESP to run new firmware (chỉ dùng softReset vì hardReset không có trong esptool-js)
      try {
        await this.esploader.softReset(false); // false = không ở lại bootloader
        console.log("ESP soft reset completed");
      } catch {
        console.warn("Soft reset failed");
        // Không throw error vì firmware đã được flash thành công
        // User có thể reset thủ công bằng nút RESET trên board
      }

      this.onProgress?.({
        percentage: 100,
        message: "Nạp code thành công!",
      });

      console.log("ESP32/ESP8266 flash completed successfully");
    } catch (error) {
      console.error("ESP32 flash error:", error);

      // Kiểm tra lỗi cụ thể và đưa ra gợi ý
      let errorMessage =
        error instanceof Error ? error.message : "Lỗi không xác định";

      if (errorMessage.includes("No serial data received")) {
        errorMessage =
          "Không nhận được dữ liệu từ ESP. Hãy thử:\n" +
          "1. Nhấn giữ nút BOOT trên board\n" +
          "2. Nhấn nút RESET\n" +
          "3. Thả nút RESET\n" +
          "4. Thả nút BOOT\n" +
          "5. Thử lại việc nạp code";
      } else if (
        errorMessage.includes("Failed to communicate with the flash chip")
      ) {
        errorMessage =
          "Không kết nối được với chip flash. Hãy thử:\n" +
          "1. Kiểm tra dây kết nối USB\n" +
          "2. Thử cổng USB khác\n" +
          "3. Đảm bảo driver CH340/CP2102 đã được cài đặt";
      }

      throw new Error(`Flash ESP32 thất bại: ${errorMessage}`);
    } finally {
      // QUAN TRỌNG: Disconnect transport để giải phóng port
      if (this.transport) {
        try {
          await this.transport.disconnect();
          console.log("✅ Transport disconnected, port đã được giải phóng");
        } catch (disconnectErr) {
          console.warn("⚠️ Không thể disconnect transport:", disconnectErr);
        }
      }
    }
  }

  /**
   * Enter bootloader mode manually (for boards without auto-reset)
   */
  static async enterBootloaderMode(): Promise<void> {
    toast.info(
      `Hướng dẫn vào chế độ Bootloader (ESP32/ESP8266): Giữ nút BOOT (hoặc FLASH/IO0) rồi nhấn nút RESET (hoặc EN/RST) cuối cùng hãy thả nút BOOT`,
      { duration: 8000 }
    );
  }

  /**
   * Hiển thị hướng dẫn khắc phục lỗi flash chip
   */
  static showFlashChipTroubleshooting(): void {
    toast.error("Không kết nối được với chip flash!", {
      duration: 15000,
    });

    setTimeout(() => {
      toast.info("Các bước khắc phục:", {
        duration: 15000,
      });
    }, 500);

    setTimeout(() => {
      toast.info("1. Kiểm tra cáp USB (thử cáp khác)", {
        duration: 15000,
      });
    }, 1500);

    setTimeout(() => {
      toast.info("2. Thử cổng USB khác trên máy tính", {
        duration: 15000,
      });
    }, 2500);

    setTimeout(() => {
      toast.info("3. Cài đặt driver CH340/CP2102 nếu chưa có", {
        duration: 15000,
      });
    }, 3500);

    setTimeout(() => {
      toast.info("4. Vào bootloader mode thủ công (xem hướng dẫn)", {
        duration: 15000,
      });
    }, 4500);
  }
}
