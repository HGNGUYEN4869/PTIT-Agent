"use client";

import React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  FileText,
  History,
  User2,
  ChevronDown,
} from "lucide-react"; // hoặc từ icon bạn dùng
import { useRouter } from "next/navigation";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "@/store/authSlice";
import { logout } from "@/app/api/auth";
import HistoryChatMenu from "./HistoryChatMenu";


export function AppSidebar() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { username, isAuthenticated, email } = useSelector(
    (state: RootState) => state.auth
  );

  const handleNewChat = () => {
    router.push("/");
  };

  const handleSignOut = async () => {
    try {
      if (email) {
        await logout(email);
      } else {
        console.error("Failed to sign out: no email");
      }

      // Xóa auth state trong Redux
      dispatch(clearAuth());

      // Redirect về trang login
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out", error);

      // Vẫn clear auth state và redirect dù có lỗi
      dispatch(clearAuth());
      router.push("/login");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
          {/* Logo trái */}
          <img
            src="/Logo_PTIT_University.png"
            alt="Logo"
            className="w-16 h-16 rounded-md"
          />
          <span className="text-lg font-semibold">AGENT</span>
        </div>
      </SidebarHeader>

      {isAuthenticated ? (
        <SidebarContent className="px-2 py-4">
          <SidebarMenu>
            {/* Mục tạo mới chat */}
            <SidebarMenuItem key="new-chat">
              <SidebarMenuButton asChild>
                <button
                  onClick={handleNewChat}
                  className="flex items-center w-full px-2 py-1 space-x-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  <FileText className="w-4 h-4" />
                  <span>Đoạn chat mới</span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* Nhóm lịch sử đoạn chat có thể thu gọn */}
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1 rounded-md hover:bg-accent">
                  <div className="flex items-center w-full gap-2 space-x-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground">
                    <History className="w-4 h-4" />
                    <span>Lịch sử đoạn chat</span>
                  </div>
                  <ChevronDown className="w-4 h-4 ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarMenuItem>

              <CollapsibleContent>
                <HistoryChatMenu></HistoryChatMenu>
              </CollapsibleContent>
            </Collapsible>
          </SidebarMenu>
        </SidebarContent>
      ) : (
        <></>
      )}

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 /> {username ? username : "User Name"}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem>
                  <span>Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
