"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { AlertCircle, Loader2 } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatInputBar from "./ChatInputBar";
import ChatMessageItem from "./ChatMessageItem";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { DEFAULT_MODEL_ID, type ModelId } from "@/config/models";
import type { NormalizedMealDbRecipe } from "@/lib/recipes/mealdb";
import type { ChatMessage } from "@/lib/ai/tools";

interface ChatInterfaceProps {
  initialChatId?: string;
  initialMessages?: ChatMessage[];
}

function createChatId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export default function ChatInterface({
  initialChatId,
  initialMessages,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL_ID);
  const activeChatIdRef = useRef<string | null>(initialChatId ?? null);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    regenerate,
    clearError,
    stop,
  } = useChat<ChatMessage>({
    id: initialChatId,
    messages: initialMessages,
    onFinish: ({ isError, isAbort, isDisconnect }) => {
      if (!isError && !isAbort && !isDisconnect) {
        router.refresh();
      }
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const isQuotaError = error?.message?.includes("QUOTA_EXCEEDED") ?? false;
  const isOverloadedError =
    error?.message?.includes("MODEL_OVERLOADED") ?? false;
  const isAwaitingAssistantStart =
    isBusy &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  function handleSendMessage({
    text,
    files,
  }: {
    text?: string;
    files?: FileUIPart[];
  }) {
    const hasFiles = Boolean(files && files.length > 0);
    if (!text && !hasFiles) {
      return;
    }

    const resolvedChatId = activeChatIdRef.current ?? createChatId();
    activeChatIdRef.current = resolvedChatId;

    if (typeof window !== "undefined" && window.location.pathname === "/") {
      window.history.replaceState(null, "", `/chat/${resolvedChatId}`);
    }

    const requestBody = { model: selectedModel, chatId: resolvedChatId };
    if (text) {
      sendMessage({ text, files }, { body: requestBody });
    } else if (files && files.length > 0) {
      sendMessage({ files }, { body: requestBody });
    }
  }

  function handleRetry() {
    const resolvedChatId = activeChatIdRef.current ?? createChatId();
    activeChatIdRef.current = resolvedChatId;
    regenerate({ body: { model: selectedModel, chatId: resolvedChatId } });
  }

  function handleSelectRecipe(recipe: NormalizedMealDbRecipe) {
    handleSendMessage({ text: `Show me the recipe for ${recipe.title}` });
  }

  function handleImportUrl(url: string) {
    handleSendMessage({ text: `Import the recipe from ${url}` });
  }

  function handleNewChat() {
    stop();
    clearError();
    setMessages([]);
    activeChatIdRef.current = null;
    setChatSessionKey((prev) => prev + 1);
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      router.push("/");
    }
  }

  return (
    <div
      className="relative flex h-full w-full flex-col bg-background text-text overflow-hidden"
      style={{
        height: "var(--app-viewport-height, 100dvh)",
        top: "var(--app-viewport-top, 0px)",
      }}
    >
      <ChatHeader
        onNewChat={handleNewChat}
        canNewChat={
          messages.length > 0 ||
          Boolean(error) ||
          isBusy ||
          Boolean(initialChatId)
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 pt-3 sm:pt-6 pb-4 sm:pb-6 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:[scrollbar-gutter:stable_both-edges]">
        <div className="mx-auto flex w-full max-w-[704px] flex-col gap-4 sm:gap-6 pb-2 sm:pb-4">
          {messages.length === 0 ? (
            <ChatWelcomeScreen
              key={chatSessionKey}
              shuffleOnMount={chatSessionKey > 0}
              onSelectPrompt={(promptText) =>
                handleSendMessage({ text: promptText })
              }
              disabled={isBusy}
            />
          ) : (
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat conversation"
              className="flex flex-col gap-6"
            >
              {messages.map((message, messageIndex) => {
                const isLastMessage = messageIndex === messages.length - 1;
                const hasTextPart = message.parts.some(
                  (p) => p.type === "text" && p.text.trim().length > 0,
                );
                const hasActiveTool = message.parts.some(
                  (p) =>
                    p.type.startsWith("tool-") &&
                    "state" in p &&
                    (p.state === "input-streaming" ||
                      p.state === "input-available"),
                );
                const isAwaitingText =
                  isLastMessage &&
                  isBusy &&
                  !hasTextPart &&
                  !hasActiveTool &&
                  message.role !== "user";

                return (
                  <ChatMessageItem
                    key={message.id}
                    message={message}
                    isAwaitingText={isAwaitingText}
                    isBusy={isBusy}
                    onSelectRecipe={handleSelectRecipe}
                    onImportUrl={handleImportUrl}
                  />
                );
              })}

              {isAwaitingAssistantStart && (
                <article className="flex flex-col w-full min-w-0 items-start">
                  <span className="mb-1 text-xs font-medium text-text-muted">
                    Cooking Companion
                  </span>
                  <div
                    className="flex items-center gap-2 py-1 text-sm text-text-muted"
                    aria-label="Cooking companion is thinking"
                  >
                    <Loader2
                      className="h-4 w-4 animate-spin text-accent-strong"
                      aria-hidden="true"
                    />
                    <span>Writing your response&hellip;</span>
                  </div>
                </article>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-warning bg-surface p-4 text-text sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="font-medium text-warning">
                    {isQuotaError
                      ? "Model rate limit or quota reached"
                      : isOverloadedError
                        ? "Model is temporarily busy"
                        : "Something went wrong in the kitchen"}
                  </p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {isQuotaError
                      ? "This model has reached its rate limit or daily quota. Please switch to another model using the selector in the input bar below, then click Try again."
                      : isOverloadedError
                        ? "This model is currently experiencing high demand. Please switch to another model using the selector in the input bar below, or click Try again in a moment."
                        : "We couldn't reach the cooking assistant right now. Please check your connection or switch models and try again."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-warning px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning disabled:cursor-not-allowed"
              >
                Try again
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <ChatInputBar
        key={chatSessionKey}
        onSendMessage={handleSendMessage}
        onStop={stop}
        isBusy={isBusy}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
    </div>
  );
}
