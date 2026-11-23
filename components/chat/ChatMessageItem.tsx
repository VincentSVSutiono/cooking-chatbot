"use client";

import type { FileUIPart } from "ai";
import { Loader2, FileText, ExternalLink, Globe, ChefHat } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import ToolStatusPill from "./ToolStatusPill";
import RecipeMatchList from "@/components/recipes/RecipeMatchList";
import RecipeCard, { RecipeCardError } from "@/components/recipes/RecipeCard";
import RecipeAttribution, {
  getMatchedRecipesFromMessage,
} from "@/components/recipes/RecipeAttribution";
import type { NormalizedMealDbRecipe } from "@/lib/recipes/mealdb";
import type { SearchWebPageSource } from "@/lib/ai/tavily";
import type { ChatMessage, RecipeCardToolPart } from "@/lib/ai/tools";

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
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent-strong underline decoration-accent-strong/50 underline-offset-2 transition-colors hover:decoration-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

function getUniqueWebSources(message: ChatMessage): SearchWebPageSource[] {
  const seen = new Set<string>();
  const unique: SearchWebPageSource[] = [];

  for (const part of message.parts) {
    if (
      part.type !== "tool-webSearch" ||
      part.state !== "output-available" ||
      part.output.status !== "success"
    ) {
      continue;
    }

    for (const source of part.output.results) {
      if (!source.url || seen.has(source.url)) continue;
      seen.add(source.url);
      unique.push(source);
    }
  }

  return unique;
}

const NON_IMPORTABLE_WEB_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "vimeo.com",
  "tiktok.com",
  "m.tiktok.com",
]);

function getWebSourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || url;
  } catch {
    return url;
  }
}

function isImportableWebSourceUrl(url: string): boolean {
  return !NON_IMPORTABLE_WEB_HOSTS.has(getWebSourceHostname(url).toLowerCase());
}

function getWebSourceLabel(source: SearchWebPageSource): string {
  if (source.title?.trim()) return source.title.trim();
  return getWebSourceHostname(source.url);
}

function hasSuccessfulRecipeCard(message: ChatMessage): boolean {
  return message.parts.some(
    (part) =>
      (part.type === "tool-getRecipe" ||
        part.type === "tool-importUrlRecipe") &&
      part.state === "output-available" &&
      part.output.status === "success",
  );
}

function FileAttachmentView({ part }: { part: FileUIPart }) {
  const isImage = part.mediaType?.startsWith("image/");
  const fileLabel = part.filename || "Attached file";

  if (isImage) {
    return (
      <div className="mb-2 last:mb-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={part.url}
          alt={fileLabel}
          className="max-h-60 w-auto max-w-full rounded-xl border border-border bg-surface object-contain"
        />
      </div>
    );
  }

  return (
    <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text last:mb-0">
      <FileText
        className="h-4 w-4 shrink-0 text-accent-strong"
        aria-hidden="true"
      />
      <span className="truncate">{fileLabel}</span>
    </div>
  );
}

function RecipeCardToolView({ part }: { part: RecipeCardToolPart }) {
  const output = part.state === "output-available" ? part.output : undefined;

  return (
    <div>
      <ToolStatusPill part={part} />
      {output?.status === "success" && <RecipeCard recipe={output.recipe} />}
      {output && output.status !== "success" && (
        <RecipeCardError title={output.title} message={output.message} />
      )}
    </div>
  );
}

interface ChatMessageItemProps {
  message: ChatMessage;
  isAwaitingText: boolean;
  isBusy: boolean;
  onSelectRecipe: (recipe: NormalizedMealDbRecipe) => void;
  onImportUrl: (url: string) => void;
}

/**
 * Renders a single user or assistant message bubble along with file previews,
 * tool status pills, recipe cards, and web/recipe source footers.
 */
export default function ChatMessageItem({
  message,
  isAwaitingText,
  isBusy,
  onSelectRecipe,
  onImportUrl,
}: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const matchedRecipes = !isUser ? getMatchedRecipesFromMessage(message) : [];
  const webSources = !isUser ? getUniqueWebSources(message) : [];
  const isRecipeWebSearch =
    !isUser && message.parts.some((part) => part.type === "tool-searchRecipes");
  const hasRecipeCard = !isUser && hasSuccessfulRecipeCard(message);

  return (
    <article
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
          const partKey = `${message.id}-part-${index}`;

          switch (part.type) {
            case "file":
              return <FileAttachmentView key={partKey} part={part} />;

            case "text":
              return (
                <div key={partKey} className="prose-cooking">
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                    {part.text}
                  </ReactMarkdown>
                </div>
              );

            case "tool-searchRecipes": {
              const hasMatches =
                part.state === "output-available" &&
                part.output.found &&
                part.output.recipes.length > 0;

              return (
                <div key={partKey}>
                  <ToolStatusPill part={part} />
                  {hasMatches && (
                    <RecipeMatchList
                      recipes={part.output.recipes}
                      onSelectRecipe={onSelectRecipe}
                      disabled={isBusy}
                    />
                  )}
                </div>
              );
            }

            case "tool-getRecipe":
            case "tool-importUrlRecipe":
              return <RecipeCardToolView key={partKey} part={part} />;

            case "tool-webSearch":
              return <ToolStatusPill key={partKey} part={part} />;

            default:
              return null;
          }
        })}

        {isAwaitingText && (
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
        )}

        {webSources.length > 0 && (
          <footer
            aria-label="Web search sources"
            className="mt-4 pt-3 border-t border-border/70 text-xs text-text-muted space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-1 font-medium">
              <div className="flex items-center gap-1.5">
                <Globe
                  className="h-3.5 w-3.5 text-accent-strong"
                  aria-hidden="true"
                />
                <span>Web sources</span>
              </div>
              {isRecipeWebSearch && (
                <span className="text-[11px] font-normal text-text-muted/80">
                  Open webpage or import as recipe card
                </span>
              )}
            </div>

            {isRecipeWebSearch ? (
              <div className="flex w-full min-w-0 flex-col gap-2">
                {webSources.map((source) => {
                  const label = getWebSourceLabel(source);
                  const hostname = getWebSourceHostname(source.url);
                  const canImport = isImportableWebSourceUrl(source.url);
                  return (
                    <div
                      key={`${message.id}-source-${source.url}`}
                      className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 transition-colors hover:border-accent-strong/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-user-message/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-text">
                            {label}
                          </p>
                          <p className="truncate text-[11px] text-accent-strong">
                            {hostname}
                          </p>
                        </div>
                        <ExternalLink
                          className="h-3.5 w-3.5 shrink-0 text-accent-strong"
                          aria-hidden="true"
                        />
                      </a>

                      {canImport && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onImportUrl(source.url)}
                          aria-label={`Import recipe card from ${label}`}
                          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-text transition-colors hover:border-accent-strong hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChefHat
                            className="h-3.5 w-3.5 shrink-0 text-accent-strong"
                            aria-hidden="true"
                          />
                          <span>Import recipe</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {webSources.map((source) => (
                  <a
                    key={`${message.id}-source-${source.url}`}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-medium text-accent-strong transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    <span className="truncate">
                      {getWebSourceLabel(source)}
                    </span>
                    <ExternalLink
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            )}
          </footer>
        )}

        {!hasRecipeCard && <RecipeAttribution recipes={matchedRecipes} />}
      </div>
    </article>
  );
}
