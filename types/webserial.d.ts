// src/types/webserial.d.ts

// --- Web Serial API ---
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
}

interface SerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface Navigator {
  serial: {
    requestPort(options?: { filters: any[] }): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  };
}

// --- WebUSB + DFU ---
interface USBDevice {
  vendorId: number;
  productId: number;
}

interface Navigator {
  usb: {
    getDevices(): Promise<USBDevice[]>;
    requestDevice(options: { filters: { vendorId: number }[] }): Promise<USBDevice>;
  };
}
