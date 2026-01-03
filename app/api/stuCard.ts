import { stuCardApi } from "../../lib/axios";

export async function verifyStudentCard(file: File) {
  const formData = new FormData();
  if (file) formData.append("file", file);

  const res = await stuCardApi.post("/gui_anh", formData, {
    headers: {
      accept: "application/json",
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}