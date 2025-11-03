"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";

const IDECode = dynamic(
  () => import("@/components/component/IDECode").then((mod) => mod.IDECode),
  {
    ssr: false,
    loading: () => null,
  }
);
export function IDECodeModule() {
  const { isAgentMode } = useSelector((state: RootState) => state.chat);

  return (
    <>
      <AnimatePresence mode="wait">
        {isAgentMode && (
          <motion.div
            key="idecode"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="origin-left"
          >
            <IDECode />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
