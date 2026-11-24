import { Loader2 } from "lucide-react";

export default function ChatLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading saved chat"
      className="relative flex h-full w-full flex-col overflow-hidden bg-background text-text"
      style={{
        height: "var(--app-viewport-height, 100dvh)",
        top: "var(--app-viewport-top, 0px)",
      }}
    >
      <div className="shrink-0 border-b border-border bg-surface/95 px-3 py-2.5 sm:px-4 sm:py-3 md:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="h-6 w-48 animate-pulse rounded-md bg-border/60" />
          <div className="h-10 w-10 animate-pulse rounded-lg bg-border/60 sm:h-11 sm:w-28" />
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-hidden px-4 pt-5 pb-6 sm:px-6 md:px-8">
        <div className="mx-auto flex w-full max-w-[704px] flex-col gap-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2
              className="h-4 w-4 animate-spin text-accent-strong"
              aria-hidden="true"
            />
            <span>Opening your saved chat&hellip;</span>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="h-3 w-10 animate-pulse rounded bg-border/60" />
            <div className="h-12 w-3/4 max-w-sm animate-pulse rounded-2xl bg-user-message/70" />
          </div>

          <div className="flex flex-col items-start gap-2.5">
            <div className="h-3 w-28 animate-pulse rounded bg-border/60" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-border/60" />
            <div className="h-4 w-5/6 max-w-lg animate-pulse rounded bg-border/50" />
            <div className="h-4 w-2/3 max-w-md animate-pulse rounded bg-border/40" />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="h-3 w-10 animate-pulse rounded bg-border/60" />
            <div className="h-10 w-1/2 max-w-xs animate-pulse rounded-2xl bg-user-message/70" />
          </div>
        </div>
      </main>

      <div className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto h-12 w-full max-w-[704px] animate-pulse rounded-xl bg-border/40" />
      </div>
    </div>
  );
}
