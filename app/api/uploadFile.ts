import { api } from "../../lib/axios";

export async function uploadRagFile(file: File) {
  const formData = new FormData();
  if (file) formData.append("file", file);

  const res = await api.post("/rag/upload", formData, {
    headers: {
      accept: "application/json",
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}
