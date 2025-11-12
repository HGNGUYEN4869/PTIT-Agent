/**
 * Serial Port Manager
 * Quản lý kết nối Serial Port với Arduino/ESP32/ESP8266
 */

export class SerialPortManager {
  private ports: Map<string, SerialPort> = new Map();
  private activeReaders: Map<string, ReadableStreamDefaultReader> = new Map();

  /**
   * Kiểm tra browser có hỗ trợ Serial API không
   */
  static isSupported(): boolean {
    return typeof window !== "undefined" && "serial" in navigator;
  }

  /**
   * Request user chọn port
   */
  async requestPort(): Promise<SerialPort> {
    if (!SerialPortManager.isSupported()) {
      throw new Error("Web Serial API is not supported in this browser");
    }

    const port = await navigator.serial.requestPort();
    return port;
  }

  /**
   * Mở port với baudrate
   */
  async openPort(port: SerialPort, baudRate: number = 115200): Promise<string> {
    await port.open({ baudRate });

    const portId = this.generatePortId(port);
    this.ports.set(portId, port);

    console.log(`Serial port opened: ${portId} @ ${baudRate} baud`);
    return portId;
  }

  /**
   * Lấy port theo ID
   */
  getPort(portId: string): SerialPort | undefined {
    return this.ports.get(portId);
  }

  /**
   * Lấy tất cả ports đang mở
   */
  getActivePorts(): Map<string, SerialPort> {
    return this.ports;
  }

  /**
   * Đóng port
   */
  async closePort(portId: string): Promise<void> {
    const port = this.ports.get(portId);
    if (!port) return;

    // Stop reader nếu có
    const reader = this.activeReaders.get(portId);
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      this.activeReaders.delete(portId);
    }

    await port.close();
    this.ports.delete(portId);

    console.log(`Serial port closed: ${portId}`);
  }

  /**
   * Đóng tất cả ports
   */
  async closeAll(): Promise<void> {
    for (const portId of this.ports.keys()) {
      await this.closePort(portId);
    }
  }

  /**
   * Đọc data từ port (continuous reading)
   */
  async readData(
    port: SerialPort,
    callback: (data: string) => void
  ): Promise<void> {
    if (!port.readable) {
      throw new Error("Port is not readable");
    }

    const reader = port.readable.getReader();
    const portId = this.generatePortId(port);
    this.activeReaders.set(portId, reader);

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        callback(text);
      }
    } catch (error) {
      console.error("Serial read error:", error);
    } finally {
      reader.releaseLock();
      this.activeReaders.delete(portId);
    }
  }

  /**
   * Ghi data vào port
   */
  async writeData(port: SerialPort, data: string): Promise<void> {
    if (!port.writable) {
      throw new Error("Port is not writable");
    }

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();

    try {
      await writer.write(encoder.encode(data));
      console.log(`Sent: ${data}`);
    } finally {
      writer.releaseLock();
    }
  }

  /**
   * Generate unique ID cho port
   */
  private generatePortId(port: SerialPort): string {
    // Use port info nếu có
    const info = port.getInfo();
    if (info && info.usbVendorId && info.usbProductId) {
      return `${info.usbVendorId}-${info.usbProductId}`;
    }

    // Fallback: use timestamp
    return `port-${Date.now()}`;
  }

  /**
   * Lấy danh sách tất cả ports có sẵn
   */
  async getPorts(): Promise<SerialPort[]> {
    if (!SerialPortManager.isSupported()) {
      return [];
    }

    return await navigator.serial.getPorts();
  }

  /**
   * Stop reading từ port
   */
  async stopReading(portId: string): Promise<void> {
    const reader = this.activeReaders.get(portId);
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
      this.activeReaders.delete(portId);
      console.log(`Stopped reading from ${portId}`);
    }
  }
}
