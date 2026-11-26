import "server-only";
import type { ChatMessage } from "@/lib/ai/tools";
import { getSupabaseAdminClient } from "./client";

export interface ChatSummary {
  id: string;
  title: string;
}

export interface MessageDB {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  parts: ChatMessage["parts"];
  created_at: string;
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that an untrusted route/action ID is a standard UUID v4 string
 * before sending it to Postgres or dynamic routes.
 */
export function isValidUuid(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

/**
 * Validates and narrows an untrusted input (e.g. request body field) to a
 * valid UUID v4 chat ID string, or returns `null`.
 */
export function parseValidChatId(value: unknown): string | null {
  return typeof value === "string" && isValidUuid(value) ? value : null;
}

/**
 * Converts an AI SDK `ChatMessage` into a Postgres `public.messages` record.
 */
export function toMessageDB(
  chatId: string,
  message: ChatMessage,
  createdAtIso?: string,
): MessageDB {
  return {
    id: message.id,
    chat_id: chatId,
    role: message.role,
    parts: message.parts,
    created_at: createdAtIso ?? new Date().toISOString(),
  };
}

/**
 * Converts a Postgres `public.messages` record back into an AI SDK `ChatMessage`.
 */
export function toChatMessage(row: MessageDB): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts,
  };
}

// ============================================================================
// Postgres CRUD Queries (public.chats & public.messages)
// ============================================================================

/**
 * Lists saved chats ordered by most recent activity (`updated_at DESC`).
 */
export async function listChats(): Promise<ChatSummary[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, title")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list chats: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
  }));
}

/**
 * Loads a single chat and its chronological messages (`created_at ASC`),
 * or returns `null` when the chat does not exist.
 */
export async function getChatWithMessages(
  chatId: string,
): Promise<{ chat: ChatSummary; messages: ChatMessage[] } | null> {
  if (!isValidUuid(chatId)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: chatData, error: chatError } = await supabase
    .from("chats")
    .select("id, title")
    .eq("id", chatId)
    .maybeSingle();

  if (chatError) {
    throw new Error(`Failed to load chat ${chatId}: ${chatError.message}`);
  }

  if (!chatData) {
    return null;
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("messages")
    .select("id, chat_id, role, parts, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(
      `Failed to load messages for chat ${chatId}: ${messagesError.message}`,
    );
  }

  return {
    chat: {
      id: String(chatData.id),
      title: String(chatData.title),
    },
    messages: (messageRows ?? []).map((row) =>
      toChatMessage(row as MessageDB),
    ),
  };
}

/**
 * Ensures a row exists in `public.chats` for `chatId` (creating it with
 * `initialTitle` if missing) and reports whether this call created a new chat.
 */
export async function ensureChatExists(
  chatId: string,
  initialTitle: string,
): Promise<{ isNewChat: boolean }> {
  if (!isValidUuid(chatId)) {
    throw new Error(`Invalid chat ID: ${chatId}`);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .upsert(
      { id: chatId, title: initialTitle },
      { onConflict: "id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    throw new Error(`Failed to ensure chat ${chatId}: ${error.message}`);
  }

  return { isNewChat: (data?.length ?? 0) > 0 };
}

/**
 * Upserts a batch of `ChatMessage` rows with sequential `created_at` timestamps
 * (`baseTime + index`) so `ORDER BY created_at ASC` preserves exact message order,
 * and bumps `chats.updated_at`.
 */
export async function upsertChatMessages(
  chatId: string,
  messages: ChatMessage[],
): Promise<void> {
  if (!isValidUuid(chatId)) {
    throw new Error(`Invalid chat ID: ${chatId}`);
  }

  if (messages.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const baseTime = Date.now();
  const rows = messages.map((message, index) =>
    toMessageDB(chatId, message, new Date(baseTime + index).toISOString()),
  );

  const [{ error: upsertError }, { error: chatUpdateError }] =
    await Promise.all([
      supabase.from("messages").upsert(rows, { onConflict: "id" }),
      supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId),
    ]);

  if (upsertError) {
    throw new Error(
      `Failed to save messages for chat ${chatId}: ${upsertError.message}`,
    );
  }

  if (chatUpdateError) {
    throw new Error(
      `Failed to update activity timestamp for chat ${chatId}: ${chatUpdateError.message}`,
    );
  }
}

/**
 * Updates the title of an existing chat in `public.chats`.
 */
export async function updateChatTitle(
  chatId: string,
  title: string,
): Promise<void> {
  if (!isValidUuid(chatId)) {
    throw new Error(`Invalid chat ID: ${chatId}`);
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Chat title cannot be empty.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("chats")
    .update({
      title: trimmedTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId);

  if (error) {
    throw new Error(
      `Failed to update title for chat ${chatId}: ${error.message}`,
    );
  }
}

/**
 * Deletes a chat by ID (`ON DELETE CASCADE` removes its messages).
 */
export async function deleteChatById(chatId: string): Promise<void> {
  if (!isValidUuid(chatId)) {
    throw new Error(`Invalid chat ID: ${chatId}`);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("chats").delete().eq("id", chatId);

  if (error) {
    throw new Error(`Failed to delete chat ${chatId}: ${error.message}`);
  }
}

// ============================================================================
// Fallback Title Helpers (used when LLM title generation is skipped or fails)
// ============================================================================

const MAX_FALLBACK_TITLE_LENGTH = 50;
const FILLER_PREFIX_REGEX =
  /^(?:(?:hey|hi|hello)[,\s]+)?(?:can you|could you|would you|please)(?:\s+(?:please|help me|show me|tell me|give me))?(?:\s+(?:how to|to))?(?:\s+(?:make|cook|bake|prepare))?\s+/i;

function formatUrlForTitle(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, "") || "link";
  } catch {
    return "link";
  }
}

/**
 * Extracts normalized plain text from a message's text parts.
 */
export function extractMessageText(
  message: Pick<ChatMessage, "parts"> | undefined,
): string {
  if (!message) {
    return "";
  }

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a clean deterministic fallback title (~50 chars max) from the first
 * user message so new chats always have a readable title even if LLM title
 * summarization is skipped or hits a rate limit.
 */
export function extractFallbackChatTitle(
  message: Pick<ChatMessage, "parts">,
): string {
  const rawText = extractMessageText(message);

  if (!rawText) {
    return "Photo / Recipe Upload";
  }

  const withoutUrls = rawText
    .replace(/https?:\/\/\S+/gi, formatUrlForTitle)
    .replace(/\s+/g, " ")
    .trim();

  const withoutFiller = withoutUrls.replace(FILLER_PREFIX_REGEX, "").trim();
  const baseTitle = withoutFiller || withoutUrls;
  const capitalized = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);

  if (capitalized.length <= MAX_FALLBACK_TITLE_LENGTH) {
    return capitalized;
  }

  const slice = capitalized.slice(0, MAX_FALLBACK_TITLE_LENGTH - 3);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 20 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[,\s.;:!?-]+$/g, "")}...`;
}
