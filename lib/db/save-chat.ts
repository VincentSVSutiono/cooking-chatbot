import "server-only";
import { generateChatTitleSummary } from "@/lib/ai/title";
import type { ChatMessage } from "@/lib/ai/tools";
import {
  ensureChatExists,
  extractFallbackChatTitle,
  extractMessageText,
  updateChatTitle,
  upsertChatMessages,
} from "./chats";

const TITLE_WAIT_CAP_MS = 1500;

function waitUpTo(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export interface SaveChatSession {
  /** Resolves once background title generation/update finishes (for `after()`). */
  backgroundTask: Promise<void> | null;
  /** Saves completed messages and briefly waits on the background title update. */
  onStreamEnd: ({ messages }: { messages: ChatMessage[] }) => Promise<void>;
}

/**
 * Coordinates database saving for one `/api/chat` turn:
 * 1. Ensures the chat row exists and saves the incoming user message before streaming.
 * 2. Kicks off LLM title generation in the background for brand-new chats.
 * 3. Returns `onStreamEnd` to save completed messages and cap how long we wait on the title.
 * Returns `null` when `chatId` is null (anonymous/unvalidated fallback).
 */
export async function startSaveChat(
  chatId: string | null,
  messages: ChatMessage[],
): Promise<SaveChatSession | null> {
  if (!chatId) {
    return null;
  }

  const firstUserMessage =
    messages.find((message) => message.role === "user") ?? messages[0];
  const firstUserText = extractMessageText(firstUserMessage);
  let isNewChat = false;

  try {
    const fallbackTitle = extractFallbackChatTitle(firstUserMessage);
    const ensured = await ensureChatExists(chatId, fallbackTitle);
    isNewChat = ensured.isNewChat;

    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.role === "user") {
      await upsertChatMessages(chatId, [latestMessage]);
    }
  } catch (dbError) {
    console.error("Failed to pre-persist chat message:", dbError);
  }

  let backgroundTask: Promise<void> | null = null;
  if (isNewChat) {
    backgroundTask = generateChatTitleSummary(firstUserText)
      .then(async (summaryTitle) => {
        if (summaryTitle) {
          await updateChatTitle(chatId, summaryTitle);
        }
      })
      .catch((titleError) => {
        console.error("Failed to update generated chat title:", titleError);
      });
  }

  return {
    backgroundTask,
    onStreamEnd: async ({ messages: finalMessages }) => {
      try {
        const tasks: Promise<unknown>[] = [
          upsertChatMessages(chatId, finalMessages),
        ];

        if (backgroundTask) {
          tasks.push(waitUpTo(backgroundTask, TITLE_WAIT_CAP_MS));
        }

        await Promise.all(tasks);
      } catch (dbError) {
        console.error("Failed to persist completed chat:", dbError);
      }
    },
  };
}
