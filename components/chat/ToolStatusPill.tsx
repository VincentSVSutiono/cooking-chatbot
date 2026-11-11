import { Loader2, Search, AlertCircle, ChefHat } from "lucide-react";
import type { DishSearchResult } from "@/lib/recipes/search";
import type { ShowRecipeCardOutput } from "@/lib/ai/types";

export interface ToolStatusPillProps {
  state: string;
  toolName?: "searchDishByName" | "showRecipeCard" | string;
  input?: unknown;
  output?: unknown;
}

export default function ToolStatusPill({
  state,
  toolName = "searchDishByName",
  input,
  output,
}: ToolStatusPillProps) {
  const isLoading = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error";

  // Case 1: showRecipeCard
  if (toolName === "showRecipeCard") {
    const inputObj =
      input && typeof input === "object"
        ? (input as { mealId?: string; mealName?: string })
        : undefined;
    const outputObj =
      output && typeof output === "object"
        ? (output as ShowRecipeCardOutput)
        : undefined;

    const dishName =
      outputObj && outputObj.status === "success"
        ? outputObj.recipe.title
        : outputObj?.mealName || inputObj?.mealName || inputObj?.mealId || "recipe";

    return (
      <div className="mb-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
          {isLoading ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-accent-strong"
                aria-hidden="true"
              />
              <span>Formatting recipe card for &ldquo;{dishName}&rdquo;&hellip;</span>
            </>
          ) : isError || outputObj?.status === "validation-error" || outputObj?.status === "not-found" ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <span className="text-warning">
                Unable to load recipe card for &ldquo;{dishName}&rdquo;
              </span>
            </>
          ) : (
            <>
              <ChefHat className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
              <span>Recipe card ready: &ldquo;{dishName}&rdquo;</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Case 2: searchDishByName (default)
  const inputObj =
    input && typeof input === "object"
      ? (input as { query?: string })
      : undefined;
  const outputObj =
    output && typeof output === "object"
      ? (output as DishSearchResult)
      : undefined;

  const query = outputObj?.query || inputObj?.query || "";

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
