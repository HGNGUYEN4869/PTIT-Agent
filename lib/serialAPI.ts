/**
 * Web Serial API Helper Functions
 * Wrapper around browser's Web Serial API for reading/listing serial ports
 */

export interface SerialPortInfo {
  name: string;
  productId?: number;
  vendorId?: number;
}

/**
 * List all available serial ports
 * Uses Web Serial API - requires user permission
 */
export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  try {
    if (!(navigator as any).serial) {
      throw new Error('Web Serial API not supported in this browser');
    }

    // Get all ports user has previously granted permission to
    const ports = await (navigator as any).serial.getPorts();

    const portList: SerialPortInfo[] = ports.map((port: any) => {
      const info = port.getInfo();
      return {
        name: info.usbProductId
          ? `COM (USB) - VID:${info.usbVendorId} PID:${info.usbProductId}`
          : 'Unknown Serial Port',
        productId: info.usbProductId,
        vendorId: info.usbVendorId,
      };
    });

    return portList;
  } catch (error) {
    throw new Error(`Failed to list serial ports: ${error}`);
  }
}

/**
 * Read data from serial monitor on a specific port
 *
 * @param port SerialPort object to read from (or port index)
 * @param duration How long to read data (in milliseconds)
 * @param baudRate Baud rate for serial connection (default 115200)
 * @returns String containing serial data received
 */
export async function readSerialMonitor(
  port: any,
  duration: number = 5000,
  baudRate: number = 115200
): Promise<string> {
  let selectedPort = port;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    // If port is a number, get it from list of available ports
    if (typeof port === 'number') {
      const ports = await (navigator as any).serial.getPorts();
      selectedPort = ports[port];

      if (!selectedPort) {
        throw new Error(`Port index ${port} not found`);
      }
    }

    // Open port if not already open
    if (!selectedPort.readable) {
      await selectedPort.open({ baudRate });
    }

    reader = selectedPort.readable.getReader();
    let data = '';
    let timedOut = false;

    // Read data with timeout
    const readData = async () => {
      try {
        while (!timedOut) {
          const { value, done } = await reader!.read();

          if (done) {
            console.log('Serial port closed by device');
            break;
          }

          if (value) {
            // Decode Uint8Array to string
            const decoded = new TextDecoder().decode(value);
            data += decoded;
            console.log('📊 Received:', decoded);
          }
        }
      } finally {
        if (reader) {
          reader.releaseLock();
        }
      }
    };

    // Start reading with timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, duration);
    });

    await Promise.race([readData(), timeoutPromise]);

    // Close port
    try {
      await selectedPort.close();
    } catch (closeError) {
      console.warn('Port already closed:', closeError);
    }

    return data || '(No data received)';
  } catch (error) {
    // Clean up on error
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // Already released
      }
    }

    try {
      await selectedPort?.close();
    } catch {
      // Already closed
    }

    throw new Error(`Failed to read serial monitor: ${error}`);
  }
}

/**
 * Request permission and get a serial port from user
 * This will show browser's port selection dialog
 */
export async function requestSerialPort(): Promise<any> {
  try {
    if (!(navigator as any).serial) {
      throw new Error('Web Serial API not supported in this browser');
    }

    const port = await (navigator as any).serial.requestPort();
    return port;
  } catch (error) {
    throw new Error(`Failed to request serial port: ${error}`);
  }
}

/**
 * Write data to a serial port
 */
export async function writeToSerialPort(
  port: any,
  data: string | Uint8Array,
  baudRate: number = 115200
): Promise<void> {
  try {
    if (!port) {
      throw new Error('Serial port not available');
    }

    // Open port if not already open
    if (!port.writable) {
      await port.open({ baudRate });
    }

    const writer = port.writable.getWriter();

    try {
      if (typeof data === 'string') {
        await writer.write(new TextEncoder().encode(data));
      } else {
        await writer.write(data);
      }
    } finally {
      writer.releaseLock();
    }
  } catch (error) {
    throw new Error(`Failed to write to serial port: ${error}`);
  }
}

/**
 * Open a serial port with specified baud rate
 */
export async function openSerialPort(
  port: any,
  baudRate: number = 115200
): Promise<void> {
  try {
    if (!port) {
      throw new Error('Serial port not available');
    }

    if (!port.readable || !port.writable) {
      await port.open({ baudRate });
    }
  } catch (error) {
    throw new Error(`Failed to open serial port: ${error}`);
  }
}

/**
 * Close a serial port
 */
export async function closeSerialPort(port: any): Promise<void> {
  try {
    if (port && (port.readable || port.writable)) {
      await port.close();
    }
  } catch (error) {
    console.warn(`Failed to close serial port: ${error}`);
  }
}
