import { listChats, type ChatSummary } from "@/lib/db/chats";
import ChatSidebar from "./ChatSidebar";

/**
 * Async Server Component that loads saved chats from Supabase inside a
 * `<Suspense>` boundary so `cacheComponents` can render the shell immediately.
 */
export default async function ChatSidebarServer() {
  let chats: ChatSummary[] = [];

  try {
    chats = await listChats();
  } catch (error) {
    console.error("Failed to load chat sidebar:", error);
  }

  return <ChatSidebar chats={chats} />;
}
