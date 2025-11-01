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
      flashSize: (config?.flashSize as any) ?? "4MB",
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
      const transport = new Transport(this.port as any, true);

      // Initialize ESPLoader with all required options
      this.esploader = new ESPLoader({
        transport,
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

      // Change baud rate for faster flashing (changeBaud không nhận parameter)
      try {
        await this.esploader.changeBaud();
        console.log("Baud rate changed for faster flashing");
      } catch (err) {
        console.warn("Failed to change baud rate, using default");
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
      await this.esploader.writeFlash({
        fileArray: [
          {
            data: binaryString, // esptool-js expects binary string (not UTF-8)
            address: flashOffset,
          },
        ],
        flashMode: "dio",
        flashFreq: "40m",
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
        message: "Hoàn tất, đang reset ESP32...",
      });

      // Reset ESP32 to run new firmware (dùng softReset thay vì hardReset)
      await this.esploader.softReset(false); // false = không ở lại bootloader

      this.onProgress?.({
        percentage: 100,
        message: "Nạp code thành công!",
      });

      console.log("ESP32 flash completed successfully");
    } catch (error: any) {
      console.error("ESP32 flash error:", error);
      throw new Error(`Flash ESP32 thất bại: ${error.message}`);
    }
  }

  /**
   * Enter bootloader mode manually (for boards without auto-reset)
   */
  static async enterBootloaderMode(): Promise<void> {
    toast.info("Cách vào chế độ bootloader ESP32:");
    toast.info("1. Giữ nút BOOT");
    toast.info("2. Nhấn nút RESET");
    toast.info("3. Thả nút RESET");
    toast.info("4. Thả nút BOOT");
    await new Promise((r) => setTimeout(r, 5000)); // 5s để user thực hiện
  }
}
