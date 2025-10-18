import { AuthGuard } from "@/components/component/AuthGuard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/component/LeftSiderBar";
import { X } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider defaultOpen>
        <AppSidebar />
        <div className="flex flex-col w-full h-screen bg-[url('/frame-background.png')] bg-cover">
          <div className="p-4 text-lg font-semibold border-b">
            <SidebarTrigger>
              <X className="w-5 h-5" />
            </SidebarTrigger>
            <span className="ml-2">PTIT Agent</span>
          </div>
          <div className="flex-1 overflow-y-auto content-wrap">
            {children}
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
