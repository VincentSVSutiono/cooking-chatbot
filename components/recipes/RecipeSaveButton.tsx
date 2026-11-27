"use client";

import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { saveWebRecipeAction } from "@/lib/db/actions";
import type { StructuredRecipe } from "@/lib/recipes/schema";

type SaveRecipeStatus = "idle" | "saving" | "saved" | "error";

interface RecipeSaveButtonProps {
  recipe: StructuredRecipe;
}

/**
 * Client button that persists a freshly imported web recipe (and its embedding)
 * into `public.recipes` via the `saveWebRecipeAction` Server Action.
 */
export default function RecipeSaveButton({ recipe }: RecipeSaveButtonProps) {
  const [status, setStatus] = useState<SaveRecipeStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (status === "saving" || status === "saved") return;

    setStatus("saving");
    setErrorMessage(null);

    try {
      const result = await saveWebRecipeAction(recipe);
      if (result.status === "success") {
        setStatus("saved");
        return;
      }

      setStatus("error");
      setErrorMessage(result.message);
    } catch {
      setStatus("error");
      setErrorMessage("Could not save recipe. Please try again.");
    }
  }

  const isSaving = status === "saving";
  const isSaved = status === "saved";

  return (
    <div className="flex flex-col items-start sm:items-end gap-1 max-w-full">
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isSaved}
        aria-busy={isSaving}
        aria-label={
          isSaved
            ? `Saved ${recipe.title} to recipes`
            : `Save ${recipe.title} to recipes`
        }
        className={
          isSaved
            ? "inline-flex min-h-11 max-w-full cursor-default items-center justify-center gap-1.5 rounded-lg border border-accent-strong/50 bg-user-message/60 px-3.5 py-2 text-xs font-semibold text-text"
            : "inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-text transition-colors hover:border-accent-strong hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isSaving && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-accent-strong"
            aria-hidden="true"
          />
        )}
        {isSaved && (
          <Check
            className="h-4 w-4 shrink-0 text-accent-strong"
            aria-hidden="true"
          />
        )}
        {!isSaving && !isSaved && (
          <Bookmark
            className={`h-4 w-4 shrink-0 ${
              status === "error" ? "text-warning" : "text-accent-strong"
            }`}
            aria-hidden="true"
          />
        )}

        <span>
          {isSaving
            ? "Saving..."
            : isSaved
              ? "Saved to recipes"
              : status === "error"
                ? "Retry save"
                : "Save to recipes"}
        </span>
      </button>

      {status === "error" && errorMessage && (
        <p role="status" aria-live="polite" className="text-[11px] text-warning">
          {errorMessage}
        </p>
      )}
      {isSaved && (
        <span role="status" aria-live="polite" className="sr-only">
          Saved {recipe.title} to your recipe database.
        </span>
      )}
    </div>
  );
}
