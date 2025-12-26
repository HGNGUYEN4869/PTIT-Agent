import { ApiResponse, ragResponse } from "@/types/common";
import { api } from "../../lib/axios";

export async function ragQuery(query: string):Promise<ApiResponse<ragResponse>> {
  const res = await api.post(
    "/rag/query",
    { query: query },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  return res.data;
}
