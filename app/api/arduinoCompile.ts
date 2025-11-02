import { db } from "../../lib/axios";

/**
 * Compile Arduino code
 * Upload file .ino và compile code
 */
export async function compileArduino(
  file: File,
  sessionId: string,
  board: string = "arduino:avr:uno"
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sessionId", sessionId);
  formData.append("board", board);

  const res = await db.post("/h/arduino/compile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}

/**
 * Download firmware for Arduino UNO (.hex)
 */
export async function downloadUnoFirmware(sessionId: string): Promise<Blob> {
  const res = await db.get(`/h/arduino/firmware/uno`, {
    params: { sessionId },
    responseType: "blob",
  });

  return res.data;
}

/**
 * Download firmware for ESP32 (.bin)
 */
export async function downloadEsp32Firmware(sessionId: string): Promise<Blob> {
  const res = await db.get(`/h/arduino/firmware/esp32`, {
    params: { sessionId },
    responseType: "blob",
  });

  return res.data;
}

/**
 *  Download firmware for STM32 (.dfu/.bin)
 */
export async function downloadStm32Firmware(sessionId: string): Promise<Blob> {
  const res = await db.get(`/h/arduino/firmware/stm32`, {
    params: { sessionId },
    responseType: "blob",
  });

  return res.data;
}

/**
 * Health check Arduino compiler service
 */
export async function checkArduinoHealth() {
  const res = await db.post("/h/arduino/health");
  return res.data;
}
