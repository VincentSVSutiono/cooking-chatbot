"use client";

import { PanelLeft, Plus, UtensilsCrossed } from "lucide-react";
import { useSidebar } from "./ChatShell";

interface ChatHeaderProps {
  onNewChat: () => void;
  canNewChat: boolean;
}

export default function ChatHeader({
  onNewChat,
  canNewChat,
}: ChatHeaderProps) {
  const { isDesktopOpen, toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 sm:gap-3 border-b border-border bg-surface/95 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 landscape:py-1.5 backdrop-blur-xs">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Open chat history sidebar"
        className={`inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:bg-user-message hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
          isDesktopOpen ? "lg:hidden" : ""
        }`}
      >
        <PanelLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
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
            onClick={onNewChat}
            disabled={!canNewChat}
            className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 sm:px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start a new chat"
          >
            <Plus className="h-4 w-4 text-accent-strong" aria-hidden="true" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </div>
    </header>
  );
}
