import { notFound } from "next/navigation";
import ChatInterface from "@/components/chat/ChatInterface";
import { getChatWithMessages, isValidUuid } from "@/lib/db/chats";

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    notFound();
  }

  const chatData = await getChatWithMessages(id);
  if (!chatData) {
    notFound();
  }

  return (
    <ChatInterface
      key={chatData.chat.id}
      initialChatId={chatData.chat.id}
      initialMessages={chatData.messages}
    />
  );
}
