import {
  Clock,
  ExternalLink,
  ShieldAlert,
  Utensils,
  Video,
  AlertTriangle,
} from "lucide-react";
import type { StructuredRecipe } from "@/lib/recipes/schema";
import RecipeStepsCollapsible from "./RecipeStepsCollapsible";
import RecipeImageModal from "./RecipeImageModal";

export interface RecipeCardProps {
  recipe: StructuredRecipe;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const { title, ingredients, steps, times, safetyNote, source } = recipe;

  const hasTimes = Boolean(times.prep || times.cook || times.total);

  return (
    <article
      aria-label={`Recipe card for ${title}`}
      className="my-3 flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
    >
      {/* Recipe Header & Hero Section: Cohesive side-by-side media layout */}
      <div className="flex items-start gap-3.5 sm:gap-5 border-b border-border p-4 sm:p-5">
        {/* Recipe Thumbnail (Clickable to view full photo) */}
        {source.thumbnailUrl ? (
          <RecipeImageModal
            src={source.thumbnailUrl}
            alt={title}
            dishName={title}
            sourceName={source.name}
            width={112}
            height={112}
            className="h-20 w-20 sm:h-28 sm:w-28"
          />
        ) : (
          <div
            className="flex h-20 w-20 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-accent-strong"
            aria-hidden="true"
          >
            <Utensils className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
          {/* Category & Cuisine Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            {source.category && (
              <span className="rounded-md border border-border bg-background px-2.5 py-0.5 font-medium">
                {source.category}
              </span>
            )}
            {source.area && (
              <span className="rounded-md border border-border bg-background px-2.5 py-0.5 font-medium">
                {source.area} Cuisine
              </span>
            )}
          </div>

          <h3 className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-text break-words">
            {title}
          </h3>

          {/* Timings (prep, cook, total) - only shown when available */}
          {hasTimes && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-text-muted">
              {times.prep && (
                <div className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                  <span>Prep: <strong className="font-semibold text-text">{times.prep}</strong></span>
                </div>
              )}
              {times.cook && (
                <div className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                  <span>Cook: <strong className="font-semibold text-text">{times.cook}</strong></span>
                </div>
              )}
              {times.total && (
                <div className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                  <span>Total: <strong className="font-semibold text-text">{times.total}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Food Safety / Kitchen Caution Banner (if explicitly stated in recipe) */}
      {safetyNote && (
        <div
          role="note"
          aria-label="Food safety note"
          className="flex items-start gap-2.5 border-b border-border bg-warning/10 px-4 py-3 text-sm text-text"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <strong className="font-semibold text-warning">Safety note: </strong>
            <span className="leading-relaxed">{safetyNote}</span>
          </div>
        </div>
      )}

      {/* Main Content Area: Ingredients & Steps */}
      <div className="flex flex-col gap-6 p-4 sm:p-5">
        {/* Ingredients Grid */}
        <section aria-labelledby={`recipe-ingredients-${title}`}>
          <div className="mb-2.5 flex items-center justify-between">
            <h4
              id={`recipe-ingredients-${title}`}
              className="font-serif text-base sm:text-lg font-semibold text-text"
            >
              Ingredients
            </h4>
            <span className="text-xs text-text-muted">
              {ingredients.length} items
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ingredients.map((ing, i) => (
              <li
                key={`${ing.item}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-text"
              >
                <span className="font-medium truncate">{ing.item}</span>
                {ing.amount && (
                  <span className="shrink-0 text-xs font-semibold text-text-muted bg-surface border border-border rounded px-2 py-0.5">
                    {ing.amount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Step-by-Step Instructions */}
        <section aria-labelledby={`recipe-steps-${title}`}>
          <div className="mb-2.5 flex items-center justify-between">
            <h4
              id={`recipe-steps-${title}`}
              className="font-serif text-base sm:text-lg font-semibold text-text"
            >
              Instructions
            </h4>
            <span className="text-xs text-text-muted">
              {steps.length} steps
            </span>
          </div>

          <RecipeStepsCollapsible steps={steps} />
        </section>
      </div>

      {/* Footer Links & Required TheMealDB Attribution */}
      <footer className="flex flex-col gap-2.5 border-t border-border bg-background/50 px-4 py-3 sm:px-5 text-xs text-text-muted">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {source.youtubeUrl && (
              <a
                href={source.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent-strong hover:underline focus-visible:outline-accent-strong"
              >
                <Video className="h-4 w-4" aria-hidden="true" />
                <span>Watch video tutorial</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}

            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-accent-strong hover:underline focus-visible:outline-accent-strong"
            >
              <span>Original recipe source</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          <span>Recipe data and imagery:</span>
          <a
            href={
              source.name === "TheMealDB" && !source.url
                ? "https://www.themealdb.com/"
                : source.url
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline focus-visible:outline-accent-strong"
          >
            {source.name}
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          </a>
        </div>
      </footer>
    </article>
  );
}

export interface RecipeCardErrorProps {
  mealName?: string;
  message: string;
}

export function RecipeCardError({ mealName, message }: RecipeCardErrorProps) {
  return (
    <div
      role="alert"
      className="my-3 flex flex-col gap-2 rounded-xl border border-warning/40 bg-surface p-4 text-sm text-text"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <h4 className="font-semibold text-warning">
            {mealName ? `Unable to format recipe for "${mealName}"` : "Unable to format recipe"}
          </h4>
          <p className="text-xs leading-relaxed text-text-muted">
            {message || "The recipe instructions could not be formatted into structured steps. Please try searching for another dish."}
          </p>
        </div>
      </div>
    </div>
  );
}
