"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";

interface ChatErrorProps {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}

export default function ChatError({ error, retry, reset }: ChatErrorProps) {
  useEffect(() => {
    console.error("Failed to load chat route:", error);
  }, [error]);

  function handleRetry() {
    (retry ?? reset)?.();
  }

  return (
    <main className="flex h-full w-full items-center justify-center overflow-y-auto bg-background px-4 py-8 text-text sm:px-6">
      <section
        role="alert"
        aria-labelledby="chat-error-heading"
        className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-warning bg-surface p-5 sm:p-7"
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-6 w-6 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="space-y-1.5">
            <h1
              id="chat-error-heading"
              className="font-serif text-xl font-semibold text-text sm:text-2xl"
            >
              Couldn&apos;t load this chat
            </h1>
            <p className="max-w-[65ch] text-sm leading-relaxed text-text-muted sm:text-base">
              We had trouble loading your saved conversation. This can happen
              during a temporary connection hiccup.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-warning bg-background px-4 py-2.5 text-sm font-medium text-warning transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Try again</span>
          </button>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <ArrowLeft
              className="h-4 w-4 text-accent-strong"
              aria-hidden="true"
            />
            <span>Back to new chat</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
