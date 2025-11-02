"use client";

import { AuthGuard } from "@/components/component/AuthGuard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/component/LeftSiderBar";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { setAgentMode } from "@/store/chatSlice";
import { useEffect } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAgentMode } = useSelector((state: RootState) => state.chat);
  const dispatch = useDispatch();

  const handleToggleAgentMode = () => {
    dispatch(setAgentMode(!isAgentMode));
  };

  useEffect(() => {
  }, [isAgentMode]);

  return (
    <AuthGuard>
      <SidebarProvider defaultOpen={!isAgentMode}>
        {!isAgentMode && <AppSidebar />}
        <div
          className={`flex flex-col h-screen bg-[url('/frame-background.png')] bg-cover transition-all duration-300 ${
            isAgentMode
              ? "fixed right-0 w-[25vw] shadow-2xl border-l-2 border-gray-300"
              : "w-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 text-lg font-semibold border-b">
            <div className="flex items-center">
              {!isAgentMode && (
                <SidebarTrigger>
                  <X className="w-5 h-5" />
                </SidebarTrigger>
              )}
              <span className={!isAgentMode ? "ml-2" : ""}>PTIT Agent</span>
            </div>

            {/* Toggle Agent Mode Button */}
            <button
              onClick={handleToggleAgentMode}
              className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isAgentMode ? "Thoát Agent Mode" : "Vào Agent Mode"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto content-wrap">{children}</div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
