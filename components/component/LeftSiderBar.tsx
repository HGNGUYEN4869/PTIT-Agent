"use client";

import React, { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarFooter,
  SidebarGroup,
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
  MoreHorizontal,
  Edit3,
  Trash2,
  User2,
  ChevronDown,
} from "lucide-react"; // hoặc từ icon bạn dùng
import { useRouter } from "next/navigation";
import { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "@/store/authSlice";
import { logout } from "@/app/api/auth";

interface ChatThread {
  id: string;
  title: string;
  // các trường khác nếu cần
}

export function AppSidebar() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { username, isAuthenticated, email } = useSelector(
    (state: RootState) => state.auth
  );

  // fetch API khi mount
  useEffect(() => {
    async function fetchThreads() {
      setLoading(true);
      try {
        // ❌ fake data tại đây thay vì fetch thật
        const fakeData: ChatThread[] = [
          { id: "1", title: "Đoạn chat hôm nay" },
          { id: "2", title: "Lịch sử cũ" },
        ];
        // mô phỏng delay 0.5s để có hiệu ứng loading
        await new Promise((r) => setTimeout(r, 500));
        setThreads(fakeData);
      } catch (err) {
        console.error("Failed to fetch threads", err);
      } finally {
        setLoading(false);
      }
    }
    fetchThreads();
  }, []);

  const handleRename = (thread: ChatThread) => {
    // xử lý đổi tên
    console.log("rename", thread.id);
  };

  const handleDelete = (thread: ChatThread) => {
    // xử lý xóa
    console.log("delete", thread.id);
  };

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
                <SidebarMenu className="mt-1 space-y-1">
                  {loading ? (
                    <SidebarMenuItem key="loading">
                      <SidebarMenuButton asChild>
                        <div className="w-full h-6 bg-gray-200 rounded animate-pulse" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    threads.map((thread) => (
                      <SidebarMenuItem key={thread.id}>
                        <div className="flex items-center justify-between w-full">
                          <SidebarMenuButton asChild className="!pr-2">
                            <button className="flex items-center w-full py-1 rounded-md hover:bg-accent hover:text-accent-foreground">
                              <span className="truncate">{thread.title}</span>
                            </button>
                          </SidebarMenuButton>

                          {/* Nút menu hành động “…” */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction>
                                <MoreHorizontal className="w-4 h-4" />
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                onClick={() => handleRename(thread)}
                                className="flex items-center space-x-2"
                              >
                                <Edit3 className="w-4 h-4" />
                                <span>Đổi tên</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(thread)}
                                className="flex items-center space-x-2 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Xóa</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
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
