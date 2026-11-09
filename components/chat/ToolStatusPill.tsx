import { Loader2, Search, AlertCircle } from "lucide-react";
import type { DishSearchResult } from "@/lib/recipes/search";

export interface ToolStatusPillProps {
  state: string;
  input?: unknown;
  output?: unknown;
}

export default function ToolStatusPill({
  state,
  input,
  output,
}: ToolStatusPillProps) {
  const inputObj =
    input && typeof input === "object"
      ? (input as { query?: string })
      : undefined;
  const outputObj =
    output && typeof output === "object"
      ? (output as DishSearchResult)
      : undefined;

  const query = outputObj?.query || inputObj?.query || "";
  const isLoading = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error";

  return (
    <div className="mb-2.5">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
        {isLoading ? (
          <>
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-accent-strong"
              aria-hidden="true"
            />
            <span>Searching TheMealDB for &ldquo;{query || "recipes"}&rdquo;&hellip;</span>
          </>
        ) : isError ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            <span className="text-warning">
              Search error for &ldquo;{query}&rdquo;
            </span>
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
            <span>
              {outputObj?.found
                ? `Found ${outputObj.totalMatches} recipe${outputObj.totalMatches === 1 ? "" : "s"} for "${query}"`
                : `No recipe match found for "${query}"`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
