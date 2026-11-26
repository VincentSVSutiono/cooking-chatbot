import { ExternalLink } from "lucide-react";
import {
  THEMEALDB_URL,
  type NormalizedMealDbRecipe,
} from "@/lib/recipes/mealdb";
import type { ChatMessage } from "@/lib/ai/tools";

interface RecipeAttributionProps {
  recipes: NormalizedMealDbRecipe[];
}

/**
 * Extracts all matched recipes from any tool-searchRecipes parts in an assistant message.
 */
export function getMatchedRecipesFromMessage(
  message: ChatMessage,
): NormalizedMealDbRecipe[] {
  const recipes: NormalizedMealDbRecipe[] = [];

  for (const part of message.parts) {
    if (
      part.type === "tool-searchRecipes" &&
      part.state === "output-available" &&
      part.output.found
    ) {
      recipes.push(...part.output.recipes);
    }
  }

  return recipes;
}

export default function RecipeAttribution({ recipes }: RecipeAttributionProps) {
  if (recipes.length === 0) return null;

  const hasMealDbRecipe = recipes.some(
    (recipe) => (recipe.sourceName ?? "TheMealDB") === "TheMealDB",
  );

  return (
    <footer
      aria-label="Recipe sources and attribution"
      className="mt-4 pt-3 border-t border-border/70 text-xs text-text-muted space-y-1.5"
    >
      {hasMealDbRecipe && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Recipe data and imagery:</span>
          <a
            href={THEMEALDB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline focus-visible:outline-accent-strong"
          >
            TheMealDB
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">
          {recipes.length === 1 ? "Source recipe:" : "Source recipes:"}
        </span>
        {recipes.map((recipe) => {
          const sourceName = recipe.sourceName ?? "TheMealDB";
          return (
            <a
              key={recipe.id}
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-strong hover:underline focus-visible:outline-accent-strong"
            >
              <span>
                {recipe.title}
                {sourceName !== "TheMealDB" ? ` (${sourceName})` : ""}
              </span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </footer>
  );
}
