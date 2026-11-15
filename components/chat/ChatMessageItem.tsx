"use client";

import type { UIMessage } from "ai";
import { Loader2, FileText, ExternalLink, Globe } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import ToolStatusPill from "./ToolStatusPill";
import RecipeMatchList from "./RecipeMatchList";
import RecipeCard, { RecipeCardError } from "@/components/recipes/RecipeCard";
import RecipeAttribution, {
  getMatchedRecipesFromMessage,
} from "./RecipeAttribution";
import type { NormalizedRecipe } from "@/lib/recipes/search";
import {
  isSearchToolPart,
  isRecipeCardToolPart,
  isImportUrlToolPart,
  isWebSearchToolPart,
  isTextPart,
  isFileAttachmentPart,
  isSuccessfulRecipeCard,
  type FileAttachmentPart,
  type RecipeCardToolPart,
  type ImportUrlToolPart,
  type WebSearchSource,
} from "@/lib/ai/types";

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

function getUniqueWebSources(
  parts: Array<{ type: string }>,
): WebSearchSource[] {
  const seen = new Set<string>();
  const unique: WebSearchSource[] = [];

  for (const part of parts) {
    if (
      !isWebSearchToolPart(part) ||
      part.state !== "output-available" ||
      part.output?.status !== "success"
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

function getWebSourceLabel(source: WebSearchSource): string {
  if (source.title?.trim()) return source.title.trim();
  try {
    return new URL(source.url).hostname.replace(/^www\./i, "") || source.url;
  } catch {
    return source.url;
  }
}

function FileAttachmentView({ part }: { part: FileAttachmentPart }) {
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
      <FileText className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
      <span className="truncate">{fileLabel}</span>
    </div>
  );
}

function RecipeCardToolView({
  toolName,
  part,
}: {
  toolName: "showRecipeCard" | "importRecipeFromUrl";
  part: RecipeCardToolPart | ImportUrlToolPart;
}) {
  const isAvailable = part.state === "output-available" && Boolean(part.output);

  return (
    <div>
      <ToolStatusPill toolName={toolName} {...part} />
      {isAvailable && part.output?.status === "success" && (
        <RecipeCard recipe={part.output.recipe} />
      )}
      {isAvailable && part.output && part.output.status !== "success" && (
        <RecipeCardError
          mealName={"mealName" in part.output ? part.output.mealName : undefined}
          message={part.output.message}
        />
      )}
    </div>
  );
}

export interface ChatMessageItemProps {
  message: UIMessage;
  isAwaitingText: boolean;
  isBusy: boolean;
  onSelectRecipe: (recipe: NormalizedRecipe) => void;
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
}: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const matchedRecipes = !isUser ? getMatchedRecipesFromMessage(message) : [];
  const webSources = !isUser ? getUniqueWebSources(message.parts) : [];
  const hasRecipeCard = !isUser && message.parts.some(isSuccessfulRecipeCard);

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

          if (isFileAttachmentPart(part)) {
            return <FileAttachmentView key={partKey} part={part} />;
          }

          if (isSearchToolPart(part)) {
            const hasMatches =
              part.state === "output-available" &&
              Boolean(part.output?.found && part.output.recipes.length > 0);

            return (
              <div key={partKey}>
                <ToolStatusPill toolName="searchDishByName" {...part} />
                {hasMatches && part.output && (
                  <RecipeMatchList
                    recipes={part.output.recipes}
                    onSelectRecipe={onSelectRecipe}
                    disabled={isBusy}
                  />
                )}
              </div>
            );
          }

          if (isRecipeCardToolPart(part)) {
            return (
              <RecipeCardToolView
                key={partKey}
                toolName="showRecipeCard"
                part={part}
              />
            );
          }

          if (isImportUrlToolPart(part)) {
            return (
              <RecipeCardToolView
                key={partKey}
                toolName="importRecipeFromUrl"
                part={part}
              />
            );
          }

          if (isWebSearchToolPart(part)) {
            return (
              <ToolStatusPill key={partKey} toolName="searchWeb" {...part} />
            );
          }

          if (isTextPart(part)) {
            return (
              <div key={partKey} className="prose-cooking">
                <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }

          return null;
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
            className="mt-4 pt-3 border-t border-border/70 text-xs text-text-muted space-y-2"
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Globe
                className="h-3.5 w-3.5 text-accent-strong"
                aria-hidden="true"
              />
              <span>Web sources</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {webSources.map((source) => (
                <a
                  key={`${message.id}-source-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-medium text-accent-strong transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                >
                  <span className="truncate">{getWebSourceLabel(source)}</span>
                  <ExternalLink
                    className="h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          </footer>
        )}

        {!hasRecipeCard && <RecipeAttribution recipes={matchedRecipes} />}
      </div>
    </article>
  );
}
