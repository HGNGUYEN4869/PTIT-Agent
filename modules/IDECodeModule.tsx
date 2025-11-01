"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import dynamic from "next/dynamic";

const IDECode = dynamic(
  () => import("@/components/component/IDECode").then((mod) => mod.IDECode),
  {
    ssr: false,
    loading: () => null,
  }
);
export function IDECodeModule() {
  const { isAgentMode } = useSelector((state: RootState) => state.chat);

  // Chỉ render khi isAgentMode = true
  if (!isAgentMode) return null;

  return <IDECode />;
}
