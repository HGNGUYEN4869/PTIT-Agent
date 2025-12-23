/**
 * Arduino Flasher - Hỗ trợ UNO / Nano / Mega2560
 * Giao thức STK500v1/v2 qua Web Serial API
 */

import { toast } from "sonner";

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const CRC_EOP = 0x20;
const STK_GET_SYNC = 0x30;
const STK_ENTER_PROGMODE = 0x50;
const STK_LEAVE_PROGMODE = 0x51;
const STK_LOAD_ADDRESS = 0x55;
const STK_PROG_PAGE = 0x64;

interface FlashProgress {
  percentage: number;
  message: string;
}

interface BoardConfig {
  name: string;
  baudRate: number;
  pageSize: number;
  flashSize: number;
}

// Đảm bảo TS hiểu Web Serial API
export interface SerialPort extends EventTarget {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  setSignals(signals?: SerialOutputSignals): Promise<void>;
}

interface SerialOptions {
  baudRate: number;
}

interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export class ArduinoFlasher {
  private port: SerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private onProgress?: (progress: FlashProgress) => void;
  private config: BoardConfig;

  constructor(
    port: SerialPort,
    onProgress?: (progress: FlashProgress) => void,
    config?: Partial<BoardConfig>
  ) {
    this.port = port;
    this.onProgress = onProgress;
    this.config = {
      name: config?.name ?? "Arduino UNO",
      baudRate: config?.baudRate ?? 115200,
      pageSize: config?.pageSize ?? 128,
      flashSize: config?.flashSize ?? 32 * 1024,
    };
  }

  /**Parse Intel HEX file */
  private parseIntelHex(hex: string) {
    const lines = hex.split(/\r?\n/).filter((l) => l.startsWith(":"));
    const buffer = new Uint8Array(this.config.flashSize);
    let maxAddr = 0;
    let extAddr = 0;

    for (const line of lines) {
      const len = parseInt(line.slice(1, 3), 16);
      const addr = parseInt(line.slice(3, 7), 16);
      const type = parseInt(line.slice(7, 9), 16);
      if (type === 0x00) {
        for (let i = 0; i < len; i++) {
          const data = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
          const abs = extAddr + addr + i;
          buffer[abs] = data;
          maxAddr = Math.max(maxAddr, abs);
        }
      } else if (type === 0x04) {
        extAddr = parseInt(line.slice(9, 13), 16) << 16;
      } else if (type === 0x01) break;
    }
    return { data: buffer.slice(0, maxAddr + 1), maxAddr };
  }

  /** Gửi command và nhận phản hồi */
  private async sendCommand(bytes: number[], retries = 3): Promise<Uint8Array> {
    if (!this.writer || !this.reader) throw new Error("Port not initialized");
    const cmd = new Uint8Array([...bytes, CRC_EOP]);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.writer.write(cmd);
        const response: number[] = [];
        const deadline = Date.now() + 6000; // 6s (bootloader chậm)

        while (Date.now() < deadline) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length) {
            response.push(...value);
            // scan for INSYNC ... OK anywhere
            if (
              response.includes(STK_INSYNC) &&
              response[response.length - 1] === STK_OK
            ) {
              return new Uint8Array(response);
            }
          }
        }
        throw new Error("Timeout");
      } catch (err) {
        console.warn(`Retry ${attempt}/${retries} failed:`, err);
        await new Promise((res) => setTimeout(res, 200));
      }
    }
    throw new Error("Command failed after retries");
  }

  /** Đồng bộ với bootloader */
  private async sync(): Promise<void> {
    for (let i = 0; i < 15; i++) {
      try {
        const res = await this.sendCommand([STK_GET_SYNC], 2);
        if (res[0] === STK_INSYNC && res[1] === STK_OK) {
          console.log("✅ Bootloader synced successfully");
          return;
        }
      } catch (err) {
        console.log(`Sync attempt ${i + 1} failed, retrying...`);
        //delay chờ bật bootloader
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw new Error("Không thể sync với bootloader sau 15 lần thử");
  }

  /** Tự reset nếu board hỗ trợ */
  private async tryAutoReset(): Promise<boolean> {
    try {
      await this.port.open({ baudRate: 115200 });
      await new Promise((r) => setTimeout(r, 100));
      await this.port.close();
      await new Promise((r) => setTimeout(r, 500));
      return true;
    } catch {
      return false;
    }
  }

  /** Reset thủ công */
  private async manualReset(onReset?: () => void) {
    onReset?.();
    toast.warning("Nhấn nút RESET ngay bây giờ (trong 1 giây)!");
    await new Promise((r) => setTimeout(r, 1000));
  }

  /** Upload HEX data to Arduino */
  private async uploadHex(hexData: string): Promise<void> {
    const { data, maxAddr } = this.parseIntelHex(hexData);
    console.log(
      `Parsed HEX: ${data.length} bytes, max address: 0x${maxAddr.toString(16)}`
    );

    // Enter programming mode
    const res = await this.sendCommand([STK_ENTER_PROGMODE]);
    if (!(res.includes(0x14) && res.includes(0x10))) {
      throw new Error("Không vào được bootloader – hãy nhấn RESET thủ công");
    }
    console.log("Entered programming mode");
    // Thêm bước erase toàn bộ flash
    try {
      console.log("Erasing chip...");
      await this.sendCommand([0x12]); // STK_CHIP_ERASE (nếu bootloader hỗ trợ)
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      console.warn("Bootloader không hỗ trợ lệnh erase, bỏ qua.");
    }

    // Program flash memory (page by page)
    const pageSize = this.config.pageSize;
    const totalPages = Math.ceil(data.length / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const address = (page * pageSize) / 2; // Word address
      const addrLow = address & 0xff;
      const addrHigh = (address >> 8) & 0xff;

      // Load address
      await this.sendCommand([STK_LOAD_ADDRESS, addrLow, addrHigh]);

      // Prepare page data
      const start = page * pageSize;
      const end = Math.min(start + pageSize, data.length);
      const actualLength = end - start;
      const pageData = new Uint8Array(actualLength);
      pageData.set(data.slice(start, end));

      const cmd = [
        STK_PROG_PAGE,
        (actualLength >> 8) & 0xff,
        actualLength & 0xff,
        0x46, // 'F' = flash
        ...Array.from(pageData),
      ];
      await this.sendCommand(cmd);

      const percentage = 30 + Math.floor((page / totalPages) * 60);
      this.onProgress?.({
        percentage,
        message: `Đang nạp... ${page + 1}/${totalPages} trang`,
      });
    }

    // Leave programming mode
    await this.sendCommand([STK_LEAVE_PROGMODE]);
    await new Promise((r) => setTimeout(r, 500)); // chờ reset lại
    console.log("Left programming mode");
  }

  /** Flash firmware */
  async flash(hexData: string, onNeedManualReset?: () => void): Promise<void> {
    const baudRates = [115200, 57600];
    let flashed = false;

    for (const baud of baudRates) {
      try {
        if (this.port.readable || this.port.writable) {
          console.warn("Port is already open, closing it before reopening...");
          await this.port.close().catch(() => {});
          await new Promise((r) => setTimeout(r, 300));
        }

        await this.port.open({ baudRate: baud });
        this.reader = this.port.readable!.getReader();
        this.writer = this.port.writable!.getWriter();
        console.log(`Opened port at ${baud}`);

        // Reset board bằng DTR/RTS trước khi sync
        if ("setSignals" in this.port) {
          try {
            // Bật tín hiệu reset (DTR LOW)
            await this.port.setSignals({
              dataTerminalReady: false,
              requestToSend: false,
            });
            await new Promise((r) => setTimeout(r, 250)); // Giữ reset một chút

            // Thả reset (DTR HIGH)
            await this.port.setSignals({
              dataTerminalReady: true,
              requestToSend: true,
            });
            console.log("Board reset via DTR/RTS");

            // Đợi bootloader khởi động (rất quan trọng)
            await new Promise((r) => setTimeout(r, 400));
          } catch (err) {
            console.warn("DTR/RTS not supported:", err);
            if (onNeedManualReset) {
              await this.manualReset(onNeedManualReset);
            }
          }
        } else if (onNeedManualReset) {
          await this.manualReset(onNeedManualReset);
        }

        //  Reset UNO bằng trick double-open 1200bps (giống avrdude)
        try {
          console.log("Đang reset board bằng 1200bps trick...");

          // QUAN TRỌNG: Release reader/writer TRƯỚC khi close port
          try {
            if (this.reader) {
              this.reader.releaseLock();
              this.reader = undefined;
            }
            if (this.writer) {
              this.writer.releaseLock();
              this.writer = undefined;
            }
          } catch (releaseErr) {
            console.warn("Cannot release lock:", releaseErr);
          }

          // Nếu port đang mở, đóng lại trước
          try {
            if (this.port.readable || this.port.writable) {
              await this.port.close();
              console.log("Port closed before 1200bps reset");
            }
          } catch {}

          // Chờ port close hoàn toàn
          await new Promise((r) => setTimeout(r, 500));

          // Bước 1: mở port ở 1200 baud
          await this.port.open({ baudRate: 1200 });
          console.log("Port opened at 1200bps");
          await new Promise((r) => setTimeout(r, 300));
          await this.port.close();
          console.log(
            "Đã gửi tín hiệu reset qua 1200bps, chờ bootloader khởi động..."
          );

          // Bước 2: chờ bootloader bật (~800ms)
          await new Promise((r) => setTimeout(r, 800));

          // Bước 3: mở lại port ở baud thực để nạp
          await this.port.open({ baudRate: baud });
          this.reader = this.port.readable!.getReader();
          this.writer = this.port.writable!.getWriter();
          console.log(`Port reopened at ${baud}, bắt đầu sync bootloader...`);
        } catch (err) {
          console.warn(
            "1200bps reset không hoạt động, fallback sang DTR/RTS:",
            err
          );
          // Nếu không reset được qua 1200bps, fallback sang DTR/RTS như cũ
          if ("setSignals" in this.port) {
            try {
              await this.port.setSignals({
                dataTerminalReady: false,
                requestToSend: false,
              });
              await new Promise((r) => setTimeout(r, 250));
              await this.port.setSignals({
                dataTerminalReady: true,
                requestToSend: true,
              });
              await new Promise((r) => setTimeout(r, 250));
              console.log("Board reset via DTR/RTS (fallback)");
            } catch (err2) {
              console.warn("DTR/RTS reset cũng không hoạt động:", err2);
              if (onNeedManualReset) {
                await this.manualReset(onNeedManualReset);
              }
            }
          } else if (onNeedManualReset) {
            await this.manualReset(onNeedManualReset);
          }
        }
        // Reset board lần cuối trước khi sync để chắc chắn vào bootloader
        if ("setSignals" in this.port) {
          console.log("Final hard reset before syncing...");
          await this.port.setSignals({
            dataTerminalReady: false,
            requestToSend: true,
          });
          await new Promise((r) => setTimeout(r, 250));
          await this.port.setSignals({
            dataTerminalReady: true,
            requestToSend: false,
          });
          await new Promise((r) => setTimeout(r, 250));
        }

        //  Giờ mới sync với bootloader
        await this.sync();

        this.onProgress?.({
          percentage: 10,
          message: "Đang sync với bootloader...",
        });

        this.onProgress?.({
          percentage: 30,
          message: "Sync thành công, bắt đầu nạp code...",
        });
        await this.uploadHex(hexData); // nạp dữ liệu HEX
        this.onProgress?.({
          percentage: 100,
          message: "Nạp code thành công!",
        });

        flashed = true;
        break; //  thành công, thoát vòng lặp
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        toast.error(`Flash failed at baud ${baud}: ${error.message}`);
        if (
          error.message?.includes("Timeout") ||
          error.message?.includes("sync")
        ) {
          this.onProgress?.({
            percentage: 0,
            message: `Timeout tại baud ${baud}, thử baud khác...`,
          });
        }
      } finally {
        try {
          // QUAN TRỌNG: Release lock TRƯỚC cancel/close
          if (this.reader) {
            try {
              this.reader.releaseLock();
            } catch {}
            this.reader = undefined;
          }
          if (this.writer) {
            try {
              this.writer.releaseLock();
            } catch {}
            this.writer = undefined;
          }

          // Giờ mới close port
          if (this.port) {
            try {
              if (this.port.readable || this.port.writable) {
                await this.port.close();
                console.log("✅ Port closed successfully");
              }
            } catch (closeErr) {
              console.warn("Error while closing port:", closeErr);
            }
          }
        } catch (finalErr) {
          console.warn("Error in finally block:", finalErr);
        }
      }
    }

    if (!flashed) {
      throw new Error("Flash thất bại ở cả 2 baud rate (115200 & 57600)");
    }
    // Chờ MCU reset và chạy firmware mới
    console.log("Đợi MCU khởi động lại...");
    await new Promise((r) => setTimeout(r, 3000));
    console.log("MCU đã khởi động, flash hoàn tất.");
  }
}
