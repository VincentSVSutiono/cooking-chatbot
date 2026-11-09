"use client";

import {
  useState,
  useRef,
  useEffect,
  type SubmitEvent,
  type KeyboardEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  Send,
  Plus,
  AlertCircle,
  UtensilsCrossed,
  Square,
  Loader2,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import ModelSelector from "./ModelSelector";
import ToolStatusPill from "./ToolStatusPill";
import RecipeAttribution, {
  getMatchedRecipesFromMessage,
} from "./RecipeAttribution";
import ChatWelcomeScreen, {
  STARTER_PROMPTS_POOL,
  pickRandomPrompts,
} from "./ChatWelcomeScreen";
import { DEFAULT_MODEL_ID, type ModelId } from "@/config/models";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useAutogrowTextarea } from "@/hooks/useAutogrowTextarea";

const MARKDOWN_COMPONENTS: Components = {
  strong: ({ children }) => (
    <strong className="font-semibold text-text">{children}</strong>
  ),
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2.5 list-disc pl-5 space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 list-decimal pl-5 space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => (
    <h3 className="font-serif font-bold text-lg mb-2 text-text">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="font-serif font-bold text-lg mb-2 text-text">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-serif font-semibold text-base mb-1.5 text-text">
      {children}
    </h4>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL_ID);
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

  // Manage mobile visual viewport & virtual keyboard synchronization via custom hook
  const { handleFocus, handleBlur } = useVisualViewport();

  // Auto-grow textarea height responsively via custom hook
  useAutogrowTextarea(textareaRef, input);

  // Auto-scroll to the newest message whenever messages update or stream
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  function handleSubmit(e?: SubmitEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;

    // SendMessage hits api/chat endpoint with selected model
    sendMessage({ text: trimmed }, { body: { model: selectedModel } });
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // On touchscreens / mobile keyboards, let Enter create a new line; users tap the Send button to submit.
    // On desktop with physical keyboard, Enter sends, Shift+Enter creates a new line.
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
    // SendMessage hits api/chat endpoint with selected model
    sendMessage({ text: promptText }, { body: { model: selectedModel } });
  }

  function handleNewChat() {
    stop();
    clearError();
    setMessages([]);
    setInput("");
    setStarterPrompts(pickRandomPrompts(STARTER_PROMPTS_POOL, 3));
  }

  return (
    <div
      className="fixed inset-x-0 flex flex-col bg-background text-text overflow-hidden"
      style={{
        height: "var(--app-viewport-height, 100dvh)",
        top: "var(--app-viewport-top, 0px)",
      }}
    >
      {/* Top Header - Warm kitchen identity, >=44px tap target on New chat */}
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface/95 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 landscape:py-1.5 backdrop-blur-xs">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <UtensilsCrossed
              className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-accent-strong"
              aria-hidden="true"
            />
            <h1 className="truncate font-serif text-base font-semibold tracking-tight sm:text-xl">
              Beginner Cooking Companion
            </h1>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            disabled={messages.length === 0 && !error && !isBusy}
            className="inline-flex min-h-10 sm:min-h-11 min-w-10 sm:min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 sm:px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start a new chat"
          >
            <Plus className="h-4 w-4 text-accent-strong" aria-hidden="true" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </header>

      {/* Scrollable Message Area */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 md:px-6 pt-3 sm:pt-6 pb-4 sm:pb-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 sm:gap-6 pb-2 sm:pb-4">
          {messages.length === 0 ? (
            /* Empty State - Sunny kitchen welcome with clickable starter cards */
            <ChatWelcomeScreen
              prompts={starterPrompts}
              onSelectPrompt={handleStarterClick}
              disabled={isBusy}
            />
          ) : (
            /* Active Message List */
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat conversation"
              className="flex flex-col gap-6"
            >
              {messages.map((message, messageIndex) => {
                const isUser = message.role === "user";
                const isLastMessage = messageIndex === messages.length - 1;
                const matchedRecipes = !isUser
                  ? getMatchedRecipesFromMessage(message)
                  : [];

                const hasTextPart = message.parts.some(
                  (p) => p.type === "text" && p.text.trim().length > 0,
                );
                const isAwaitingAssistantText =
                  isLastMessage && isBusy && !hasTextPart && !isUser;

                return (
                  <article
                    key={message.id}
                    className={`flex flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="mb-1 text-xs font-medium text-text-muted">
                      {isUser ? "You" : "Cooking Companion"}
                    </span>

                    {/* Per DESIGN.md: Assistant sits on background, user gets soft yellow bubble */}
                    <div
                      className={
                        isUser
                          ? "max-w-[68ch] rounded-2xl border border-border bg-user-message px-4 py-3 text-base leading-relaxed text-text"
                          : "max-w-[68ch] text-base leading-relaxed text-text"
                      }
                    >
                      {message.parts.map((part, index) => {
                        if (part.type === "tool-searchDishByName") {
                          return (
                            <ToolStatusPill
                              key={`${message.id}-tool-${index}`}
                              {...part}
                            />
                          );
                        }

                        if (part.type === "text") {
                          if (isUser) {
                            return (
                              <div
                                key={`${message.id}-text-${index}`}
                                className="whitespace-pre-wrap break-words"
                              >
                                {part.text}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`${message.id}-text-${index}`}
                              className="break-words"
                            >
                              <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }
                        return null;
                      })}

                      {/* If tool parts ran but assistant text has not arrived yet */}
                      {isAwaitingAssistantText && (
                        <div className="flex items-center gap-2 py-1 text-sm text-text-muted animate-pulse">
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin text-accent-strong"
                            aria-hidden="true"
                          />
                          <span>Writing recipe instructions&hellip;</span>
                        </div>
                      )}

                      {/* Attribution footer when recipes were retrieved */}
                      <RecipeAttribution recipes={matchedRecipes} />
                    </div>
                  </article>
                );
              })}

              {/* Streaming Indicator */}
              {status === "submitted" && (
                <div
                  role="status"
                  className="inline-flex items-center gap-2 text-sm font-medium text-text-muted animate-pulse"
                >
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin text-accent-strong"
                    aria-hidden="true"
                  />
                  <span>Thinking in the kitchen&hellip;</span>
                </div>
              )}
            </div>
          )}

          {/* Friendly Error Banner with Retry */}
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
                    {error.message?.includes("QUOTA_EXCEEDED")
                      ? "Model rate limit or quota reached"
                      : "Something went wrong in the kitchen"}
                  </p>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {error.message?.includes("QUOTA_EXCEEDED")
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

      {/* Bottom Sticky Input Bar - Claude-style layered card */}
      <footer className="w-full shrink-0 bg-background px-3 pt-1 pb-2 sm:px-4 sm:pb-3 md:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface p-2.5 sm:p-3 shadow-xs transition-colors focus-within:border-accent-strong"
        >
          <label htmlFor="chat-input" className="sr-only">
            Ask a cooking question
          </label>
          <textarea
            ref={textareaRef}
            id="chat-input"
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            value={input}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a cooking related question..."
            className="w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-text placeholder:text-text-muted focus:outline-none min-h-[28px] max-h-32 sm:max-h-36 md:max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />

          {/* Bottom Toolbar Row - Model selector on left, Send/Stop button on right */}
          <div className="flex shrink-0 items-center justify-between pt-1.5 sm:pt-2">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              disabled={isBusy}
            />

            {isBusy ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating response"
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-accent-strong transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              >
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </footer>
    </div>
  );
}
