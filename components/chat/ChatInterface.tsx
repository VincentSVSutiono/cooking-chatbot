"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import ChatHeader from "./ChatHeader";
import ChatInputBar from "./ChatInputBar";
import ToolStatusPill from "./ToolStatusPill";
import RecipeMatchList from "./RecipeMatchList";
import RecipeCard, { RecipeCardError } from "@/components/recipes/RecipeCard";
import RecipeAttribution, {
  getMatchedRecipesFromMessage,
} from "./RecipeAttribution";
import ChatWelcomeScreen, {
  STARTER_PROMPTS_POOL,
  pickRandomPrompts,
} from "./ChatWelcomeScreen";
import { DEFAULT_MODEL_ID, type ModelId } from "@/config/models";
import type { NormalizedRecipe } from "@/lib/recipes/search";
import {
  isSearchToolPart,
  isRecipeCardToolPart,
  isTextPart,
  isSuccessfulRecipeCard,
} from "@/lib/ai/types";
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

  function handleSubmit(e?: FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;

    sendMessage({ text: trimmed }, { body: { model: selectedModel } });
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // On touchscreens / mobile keyboards, let Enter create a new line; users tap Send.
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
    sendMessage({ text: promptText }, { body: { model: selectedModel } });
  }

  function handleSelectRecipe(recipe: NormalizedRecipe) {
    sendMessage(
      {
        text: `Show me the recipe for ${recipe.name}`,
      },
      { body: { model: selectedModel } },
    );
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
      className="relative flex h-full w-full flex-col bg-background text-text overflow-hidden"
      style={{
        height: "var(--app-viewport-height, 100dvh)",
        top: "var(--app-viewport-top, 0px)",
      }}
    >
      {/* Top Header */}
      <ChatHeader
        onNewChat={handleNewChat}
        canNewChat={messages.length > 0 || Boolean(error) || isBusy}
      />

      {/* Scrollable Message Area */}
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
                const isUser = message.role === "user";
                const isLastMessage = messageIndex === messages.length - 1;
                const matchedRecipes = !isUser
                  ? getMatchedRecipesFromMessage(message)
                  : [];

                const hasRecipeCard = !isUser && message.parts.some(isSuccessfulRecipeCard);

                const hasTextPart = message.parts.some(
                  (p) => isTextPart(p) && p.text.trim().length > 0,
                );
                const isAwaitingAssistantText =
                  isLastMessage && isBusy && !hasTextPart && !isUser;

                return (
                  <article
                    key={message.id}
                    className={`flex flex-col w-full min-w-0 ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="mb-1 text-xs font-medium text-text-muted">
                      {isUser ? "You" : "Cooking Companion"}
                    </span>

                    <div
                      className={
                        isUser
                          ? "max-w-[85%] sm:max-w-[75%] rounded-2xl border border-border bg-user-message px-4 py-3 text-base leading-relaxed text-text break-words"
                          : "w-full min-w-0 text-base leading-relaxed text-text"
                      }
                    >
                      {message.parts.map((part, index) => {
                        if (isSearchToolPart(part)) {
                          const hasMatches =
                            part.state === "output-available" &&
                            Boolean(
                              part.output?.found &&
                                part.output.recipes.length > 0,
                            );

                          return (
                            <div key={`${message.id}-tool-search-${index}`}>
                              <ToolStatusPill
                                toolName="searchDishByName"
                                {...part}
                              />
                              {hasMatches && part.output && (
                                <RecipeMatchList
                                  recipes={part.output.recipes}
                                  onSelectRecipe={handleSelectRecipe}
                                  disabled={isBusy}
                                />
                              )}
                            </div>
                          );
                        }

                        if (isRecipeCardToolPart(part)) {
                          const isAvailable =
                            part.state === "output-available" &&
                            Boolean(part.output);

                          return (
                            <div key={`${message.id}-tool-card-${index}`}>
                              <ToolStatusPill
                                toolName="showRecipeCard"
                                {...part}
                              />
                              {isAvailable &&
                                part.output?.status === "success" && (
                                  <RecipeCard recipe={part.output.recipe} />
                                )}
                              {isAvailable &&
                                part.output &&
                                part.output.status !== "success" && (
                                  <RecipeCardError
                                    mealName={part.output.mealName}
                                    message={part.output.message}
                                  />
                                )}
                            </div>
                          );
                        }

                        if (isTextPart(part)) {
                          return (
                            <div
                              key={`${message.id}-text-${index}`}
                              className="prose-cooking"
                            >
                              <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }

                        return null;
                      })}

                      {/* Subtle loading indicator while assistant thinking */}
                      {isAwaitingAssistantText && (
                        <div
                          className="flex items-center gap-2 py-1 text-sm text-text-muted"
                          aria-label="Cooking companion is thinking"
                        >
                          <Loader2
                            className="h-4 w-4 animate-spin text-accent-strong"
                            aria-hidden="true"
                          />
                          <span>Thinking about your recipe&hellip;</span>
                        </div>
                      )}

                      {/* Attribution footer when recipes were retrieved via search and no RecipeCard is present */}
                      {!hasRecipeCard && (
                        <RecipeAttribution recipes={matchedRecipes} />
                      )}
                    </div>
                  </article>
                );
              })}
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

      {/* Bottom Sticky Input Bar */}
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
      />
    </div>
  );
}
