import { ragApi } from "../../lib/axios";

/**
 * Upload voice file and transcribe to text
 */
export async function uploadVoiceFile(audioBlob: Blob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.weba");

  const res = await ragApi.post("/voice_text", formData, {
    headers: {
      accept: "application/json",
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}
