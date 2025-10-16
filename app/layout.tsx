import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { X } from "lucide-react";
import { AppSidebar } from "@/components/component/LeftSiderBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent PTIT",
  description: "AI assistant for PTIT students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SidebarProvider defaultOpen>
          <AppSidebar />
            <div className="flex flex-col w-full h-screen bg-[url('/frame-background.png')] bg-cover">
              <div className="p-4 text-lg font-semibold border-b">
                <SidebarTrigger>
                  <X className="w-5 h-5" />
                </SidebarTrigger>
                <span className="ml-2">PTIT Agent</span>
              </div>
              <div className="flex-1 overflow-y-auto content-wrap">{children}</div>
            </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
