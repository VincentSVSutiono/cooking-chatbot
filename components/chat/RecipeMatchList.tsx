import { ChefHat, Utensils } from "lucide-react";
import type { NormalizedRecipe } from "@/lib/recipes/search";
import RecipeImageModal from "@/components/recipes/RecipeImageModal";

export interface RecipeMatchListProps {
  recipes: NormalizedRecipe[];
  onSelectRecipe: (recipe: NormalizedRecipe) => void;
  disabled?: boolean;
}

export default function RecipeMatchList({
  recipes,
  onSelectRecipe,
  disabled = false,
}: RecipeMatchListProps) {
  if (recipes.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recipe search results"
      className="my-3 flex w-full min-w-0 max-w-full flex-col gap-2.5 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-medium text-text-muted">
        <span>
          {recipes.length === 1
            ? "Found 1 matching recipe:"
            : `Found ${recipes.length} matching recipes:`}
        </span>
        <span className="text-[11px] text-text-muted/80">Select one to view recipe</span>
      </div>

      <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5">
        {recipes.map((recipe) => {
          // TheMealDB provides 200px preview images by appending /preview
          const thumbUrl = recipe.thumbnailUrl
            ? `${recipe.thumbnailUrl}/preview`
            : null;

          return (
            <div
              key={recipe.id}
              className="flex w-full min-w-0 max-w-full flex-col gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent-strong sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {thumbUrl ? (
                  <RecipeImageModal
                    src={recipe.thumbnailUrl || thumbUrl}
                    alt={recipe.name}
                    dishName={recipe.name}
                    sourceName="TheMealDB"
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-accent-strong"
                    aria-hidden="true"
                  >
                    <Utensils className="h-6 w-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-serif text-base font-semibold text-text">
                    {recipe.name}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                    {recipe.category && (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium">
                        {recipe.category}
                      </span>
                    )}
                    {recipe.area && (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 font-medium">
                        {recipe.area}
                      </span>
                    )}
                    <span>{recipe.ingredients.length} ingredients</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectRecipe(recipe)}
                aria-label={`View full recipe for ${recipe.name}`}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChefHat className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>View full recipe</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
