"use client";

import {
  useState,
  useRef,
  useEffect,
  type SubmitEvent,
  type KeyboardEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Plus, AlertCircle, UtensilsCrossed, Square } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import ModelSelector from "./ModelSelector";
import { DEFAULT_MODEL_ID, type ModelId } from "@/config/models";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useAutogrowTextarea } from "@/hooks/useAutogrowTextarea";

const STARTER_PROMPTS_POOL = [
  "What is an easy, 20-minute dinner recipe for a complete beginner?",
  "How do I dice an onion safely without crying?",
  "What are some of the most essential cooking tools a total beginner actually needs?",
  "I have eggs, cheese, and bread in my kitchen. What can I make?",
  "How do I cook fluffy white rice on the stove without burning the bottom?",
  "What does it mean to simmer something, and what should it look like in the pan?",
  "How do I pan-sear chicken breast so it stays juicy and tender?",
  "What are 3 quick, beginner-friendly recipes I can try this week?",
  "What is the difference between sautéing and pan-frying?",
];

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

function pickRandomPrompts(pool: string[], count = 3): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
            <section
              aria-labelledby="welcome-heading"
              className="my-1 sm:my-auto flex flex-col items-start gap-3.5 sm:gap-6 rounded-xl border border-border bg-surface p-4 sm:p-7"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <h2
                  id="welcome-heading"
                  className="font-serif text-xl sm:text-2xl font-semibold text-text"
                >
                  Welcome to your kitchen companion
                </h2>
                <p className="max-w-[65ch] text-sm sm:text-base leading-relaxed text-text-muted">
                  Ask about quick recipes, ingredients in your fridge, or
                  cooking techniques. I&apos;ll guide you step by step with zero
                  judgment!
                </p>
              </div>

              <div className="w-full space-y-2 sm:space-y-2.5">
                <p className="text-xs sm:text-sm font-medium text-text-muted">
                  Try asking one of these to start:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleStarterClick(prompt)}
                      disabled={isBusy}
                      className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3.5 sm:px-4 py-2.5 sm:py-3 text-left text-sm sm:text-base leading-snug sm:leading-relaxed text-text transition-colors hover:border-accent-strong hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            /* Active Message List */
            <div
              role="log"
              aria-live="polite"
              aria-label="Chat conversation"
              className="flex flex-col gap-6"
            >
              {messages.map((message) => {
                const isUser = message.role === "user";

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
                    </div>
                  </article>
                );
              })}

              {/* Streaming Indicator */}
              {status === "submitted" && (
                <div
                  role="status"
                  className="text-sm font-medium text-text-muted animate-pulse"
                >
                  Thinking in the kitchen...
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
