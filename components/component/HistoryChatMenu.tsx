import { RootState } from "@/store/store";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Edit3, MoreHorizontal, Trash2, X } from "lucide-react";
import { Chat, HistoryChat } from "@/types/chat";
import {
  changeTitleChat,
  deleteChat,
  getHistoryChat,
} from "@/app/api/chatFetch";
import { useParams, useRouter } from "next/navigation";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { triggerRefreshHistory } from "@/store/chatSlice";
import { toast } from "sonner";

const HistoryChatMenu = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<HistoryChat>([]);
  const [reNameThreadId, setRenameThreadId] = useState<string | undefined>(
    undefined
  );
  const [newThreadName, setNewThreadName] = useState<string | undefined>(
    undefined
  );
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useParams();

  // Listen Redux state để refresh khi có thay đổi
  const { refreshHistory } = useSelector((state: RootState) => state.chat);

  const handleRouteToChat = (idChat: string) => {
    router.push(`/${idChat}`);
  };

  const handleRename = async () => {
    if (reNameThreadId && newThreadName && newThreadName.trim() !== "") {
      await changeTitleChat(reNameThreadId, newThreadName);
      dispatch(triggerRefreshHistory());
    }
      setRenameThreadId(undefined);
      setNewThreadName(undefined);
  };

  const handleDelete = async (threadId: string) => {
    if (threadId != null && threadId != undefined && threadId !== "") {
      await deleteChat(threadId);
      dispatch(triggerRefreshHistory());
      if (params.idChat === threadId) {
        router.push(`/`); // Điều hướng về trang chính sau khi xóa
      }
    }
  };

  const fetchHistoryChats = async () => {
    setLoading(true);
    try {
      const data: HistoryChat = await getHistoryChat();
      setThreads(data);
    } catch (error) {
      toast.error("Error fetching chat history");
    } finally {
      setLoading(false);
    }
  };

  // Fetch khi component mount hoặc khi refreshHistory thay đổi
  useEffect(() => {
    fetchHistoryChats();
  }, [refreshHistory]);

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
                  {reNameThreadId === thread.idChat ? (
                    <Input
                      type="text"
                      value={newThreadName}
                      onChange={(e) => setNewThreadName(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault(); // Ngăn reload form nếu có
                          handleRename();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className={`flex items-center w-full py-1 rounded-md hover:bg-accent hover:text-accent-foreground ${
                        params.idChat === thread.idChat
                          ? "bg-accent text-accent-foreground"
                          : ""
                      }`}
                      onClick={() => {
                        if (params.idChat !== thread.idChat) {
                          handleRouteToChat(thread.idChat);
                        }
                      }}
                    >
                      <span className="truncate">{thread.title}</span>
                    </button>
                  )}
                </SidebarMenuButton>

                {/* Nút menu hành động “…” */}
                {reNameThreadId === thread.idChat ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRenameThreadId(undefined), setNewThreadName(undefined);
                    }}
                  >
                    <X />
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction>
                        <MoreHorizontal className="w-4 h-4" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameThreadId(thread.idChat);
                          setNewThreadName(thread.title);
                        }}
                        className="flex items-center space-x-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Đổi tên</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(thread.idChat)}
                        className="flex items-center space-x-2 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Xóa</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
    </>
  );
};
export default HistoryChatMenu;
