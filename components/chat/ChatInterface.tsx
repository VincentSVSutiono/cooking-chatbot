"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { AlertCircle } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatInputBar from "./ChatInputBar";
import ChatMessageItem from "./ChatMessageItem";
import ChatWelcomeScreen, {
  STARTER_PROMPTS_POOL,
  pickRandomPrompts,
} from "./ChatWelcomeScreen";
import { DEFAULT_MODEL_ID, type ModelId } from "@/config/models";
import type { NormalizedRecipe } from "@/lib/recipes/search";
import { isTextPart } from "@/lib/ai/types";
import { prepareFilesForChat } from "@/lib/files/attachments";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useAutogrowTextarea } from "@/hooks/useAutogrowTextarea";

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL_ID);
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [starterPrompts, setStarterPrompts] = useState<string[]>(() =>
    STARTER_PROMPTS_POOL.slice(0, 3),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    regenerate,
    clearError,
    stop,
  } = useChat();

  const isBusy = status === "submitted" || status === "streaming";
  const isQuotaError = error?.message?.includes("QUOTA_EXCEEDED") ?? false;

  const { handleFocus, handleBlur } = useVisualViewport();
  useAutogrowTextarea(textareaRef, input);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  async function handleFilesSelected(fileList: FileList) {
    setAttachmentError(null);
    setIsPreparingFiles(true);
    try {
      const { files, error: prepError } = await prepareFilesForChat(
        fileList,
        attachments.length,
      );
      if (prepError) {
        setAttachmentError(prepError);
        return;
      }
      if (files.length > 0) {
        setAttachments((prev) => [...prev, ...files]);
      }
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not read attached file.",
      );
    } finally {
      setIsPreparingFiles(false);
    }
  }

  function handleRemoveAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  }

  function handleSubmit(e?: FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isBusy || isPreparingFiles) {
      return;
    }

    const filesToSend = attachments.length > 0 ? attachments : undefined;
    if (trimmed) {
      sendMessage(
        { text: trimmed, files: filesToSend },
        { body: { model: selectedModel } },
      );
    } else if (filesToSend) {
      sendMessage({ files: filesToSend }, { body: { model: selectedModel } });
    }

    setInput("");
    setAttachments([]);
    setAttachmentError(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // On touchscreens / mobile keyboards, Enter creates a newline; users tap Send.
    const isTouchDevice =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !isTouchDevice &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleStarterClick(promptText: string) {
    sendMessage({ text: promptText }, { body: { model: selectedModel } });
  }

  function handleSelectRecipe(recipe: NormalizedRecipe) {
    sendMessage(
      { text: `Show me the recipe for ${recipe.name}` },
      { body: { model: selectedModel } },
    );
  }

  function handleNewChat() {
    stop();
    clearError();
    setMessages([]);
    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    setIsPreparingFiles(false);
    setStarterPrompts(pickRandomPrompts(STARTER_PROMPTS_POOL, 3));
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
        canNewChat={messages.length > 0 || Boolean(error) || isBusy}
      />

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 pt-3 sm:pt-6 pb-4 sm:pb-6 [scrollbar-gutter:stable]">
        <div className="mx-auto flex w-full max-w-[704px] flex-col gap-4 sm:gap-6 pb-2 sm:pb-4">
          {messages.length === 0 ? (
            <ChatWelcomeScreen
              prompts={starterPrompts}
              onSelectPrompt={handleStarterClick}
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
                  (p) => isTextPart(p) && p.text.trim().length > 0,
                );
                const isAwaitingText =
                  isLastMessage &&
                  isBusy &&
                  !hasTextPart &&
                  message.role !== "user";

                return (
                  <ChatMessageItem
                    key={message.id}
                    message={message}
                    isAwaitingText={isAwaitingText}
                    isBusy={isBusy}
                    onSelectRecipe={handleSelectRecipe}
                  />
                );
              })}
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
                      : "Something went wrong in the kitchen"}
                  </p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {isQuotaError
                      ? "This model has reached its rate limit or daily quota. Please switch to another model using the selector in the input bar below, then click Try again."
                      : "We couldn't reach the cooking assistant right now. Please check your connection or switch models and try again."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => regenerate({ body: { model: selectedModel } })}
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
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        isBusy={isBusy}
        onStop={stop}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        textareaRef={textareaRef}
        attachments={attachments}
        attachmentError={attachmentError}
        isPreparingFiles={isPreparingFiles}
        onFilesSelected={handleFilesSelected}
        onRemoveAttachment={handleRemoveAttachment}
      />
    </div>
  );
}
