import { RootState } from "@/store/store";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { 
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction
} from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { Chat, HistoryChat } from "@/types/chat";
import { getHistoryChat } from "@/app/api/chatFetch";
import { useRouter } from "next/navigation";

const HistoryChatMenu = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<HistoryChat>([]);
  const router = useRouter();
  
  // Listen Redux state để refresh khi có thay đổi
  const { refreshHistory } = useSelector((state: RootState) => state.chat);

  const handleRouteToChat = (idChat: string) => {
    router.push(`/${idChat}`);
  };

  const handleRename = (thread: Chat) => {
    // xử lý đổi tên
    console.log("rename");
  };

  const handleDelete = (thread: Chat) => {
    // xử lý xóa
    console.log("delete");
  };

  const fetchHistoryChats = async () => {
    setLoading(true);
    try {
      const data: HistoryChat = await getHistoryChat();
      setThreads(data);
    } catch (error) {
      console.error("Error fetching history chats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch khi component mount hoặc khi refreshHistory thay đổi
  useEffect(() => {
    fetchHistoryChats();
  }, [refreshHistory]); // ✅ Thêm dependency

  return (
    <>
      <SidebarMenu className="mt-1 space-y-1">
        {loading ? (
          <SidebarMenuItem key="loading">
            <SidebarMenuButton asChild>
              <div className="w-full h-6 bg-gray-200 rounded animate-pulse" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          threads.map((thread) => (
            <SidebarMenuItem key={thread.idChat}>
              <div className="flex items-center justify-between w-full">
                <SidebarMenuButton asChild className="!pr-2">
                  <button className="flex items-center w-full py-1 rounded-md hover:bg-accent hover:text-accent-foreground"
                  onClick={() => handleRouteToChat(thread.idChat)}
                  >
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
    </>
  );
};
export default HistoryChatMenu;
