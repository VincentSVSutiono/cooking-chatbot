import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";

export default function ChatNotFound() {
  return (
    <main className="flex h-full w-full items-center justify-center overflow-y-auto bg-background px-4 py-8 text-text sm:px-6">
      <section
        aria-labelledby="chat-not-found-heading"
        className="flex w-full max-w-lg flex-col items-start gap-5 rounded-xl border border-border bg-surface p-5 sm:p-7"
      >
        <div className="flex items-start gap-3">
          <UtensilsCrossed
            className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong"
            aria-hidden="true"
          />
          <div className="space-y-1.5">
            <h1
              id="chat-not-found-heading"
              className="font-serif text-xl font-semibold text-text sm:text-2xl"
            >
              Recipe chat not found
            </h1>
            <p className="max-w-[65ch] text-sm leading-relaxed text-text-muted sm:text-base">
              This conversation doesn&apos;t exist or may have been deleted. You
              can head back to the kitchen and start a fresh chat.
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Start a new chat</span>
        </Link>
      </section>
    </main>
  );
}
