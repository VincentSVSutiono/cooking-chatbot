"use server";

import { revalidatePath } from "next/cache";
import {
  deleteChatById,
  isValidUuid,
  listChats,
  type ChatSummary,
} from "./chats";

export type DeleteChatResult =
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Fetches the current saved chat summaries without triggering a full-route
 * re-render, so the sidebar can update in place after a streamed reply.
 */
export async function listChatsAction(): Promise<ChatSummary[] | null> {
  try {
    return await listChats();
  } catch (error) {
    console.error("Failed to refresh chat list:", error);
    return null;
  }
}

/**
 * Deletes a saved chat (and cascades to its messages) from Postgres, then
 * revalidates the root layout so the sidebar chat list stays in sync.
 */
export async function deleteChatAction(
  chatId: string,
): Promise<DeleteChatResult> {
  if (!isValidUuid(chatId)) {
    return { status: "error", message: "Invalid chat ID." };
  }

  try {
    await deleteChatById(chatId);
    revalidatePath("/", "layout");
    return { status: "success" };
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return {
      status: "error",
      message: "Could not delete chat. Please try again.",
    };
  }
}
