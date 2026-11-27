import {
  Clock,
  ExternalLink,
  ShieldAlert,
  Utensils,
  Video,
  AlertTriangle,
} from "lucide-react";
import type { StructuredRecipe } from "@/lib/recipes/schema";
import { THEMEALDB_URL } from "@/lib/recipes/mealdb";
import RecipeStepsCollapsible from "./RecipeStepsCollapsible";
import RecipeNotesCollapsible from "./RecipeNotesCollapsible";
import RecipeImageModal from "./RecipeImageModal";
import RecipeSaveButton from "./RecipeSaveButton";
import { FormattedRecipeIngredient } from "./RecipeFormattedText";

interface RecipeCardProps {
  recipe: StructuredRecipe;
  canSaveToRecipes?: boolean;
}

function SectionHeader({
  id,
  title,
  countLabel,
}: {
  id: string;
  title: string;
  countLabel: string;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h4 id={id} className="font-serif text-base sm:text-lg font-semibold text-text">
        {title}
      </h4>
      <span className="text-xs text-text-muted">{countLabel}</span>
    </div>
  );
}

export default function RecipeCard({
  recipe,
  canSaveToRecipes = false,
}: RecipeCardProps) {
  const { title, ingredients, steps, notes, times, safetyNote, source } = recipe;

  const timingEntries = [
    { label: "Prep", value: times.prep },
    { label: "Cook", value: times.cook },
    { label: "Total", value: times.total },
  ].filter((entry): entry is { label: string; value: string } =>
    Boolean(entry.value),
  );

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
            title={title}
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
          {timingEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-text-muted">
              {timingEntries.map((entry) => (
                <div key={entry.label} className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-accent-strong" aria-hidden="true" />
                  <span>
                    {entry.label}: <strong className="font-semibold text-text">{entry.value}</strong>
                  </span>
                </div>
              ))}
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
          <SectionHeader
            id={`recipe-ingredients-${title}`}
            title="Ingredients"
            countLabel={`${ingredients.length} items`}
          />

          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {ingredients.map((ing, i) => (
              <li
                key={`${ing.item}-${i}`}
                className="flex items-start justify-between gap-2.5 rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-[15px] sm:text-base text-text"
              >
                <span className="min-w-0 flex-1 leading-relaxed break-words">
                  <FormattedRecipeIngredient text={ing.item} />
                </span>
                {ing.amount && (
                  <span className="mt-0.5 max-w-[45%] shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-right text-xs font-semibold leading-snug break-words text-accent-strong">
                    {ing.amount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Recipe Notes */}
        {notes && notes.length > 0 && (
          <section
            aria-labelledby={`recipe-notes-${title}`}
            className="border-t border-border/70 pt-5"
          >
            <SectionHeader
              id={`recipe-notes-${title}`}
              title="Recipe notes"
              countLabel={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
            />

            <RecipeNotesCollapsible notes={notes} />
          </section>
        )}

        {/* Step-by-Step Instructions */}
        <section
          aria-labelledby={`recipe-steps-${title}`}
          className="border-t border-border/70 pt-5"
        >
          <SectionHeader
            id={`recipe-steps-${title}`}
            title="Instructions"
            countLabel={`${steps.length} steps`}
          />

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

          {canSaveToRecipes && <RecipeSaveButton recipe={recipe} />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
          <span>Recipe data and imagery:</span>
          <a
            href={source.name === "TheMealDB" ? THEMEALDB_URL : source.url}
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

interface RecipeCardErrorProps {
  title?: string;
  message: string;
}

export function RecipeCardError({ title, message }: RecipeCardErrorProps) {
  return (
    <div
      role="alert"
      className="my-3 flex flex-col gap-2 rounded-xl border border-warning/40 bg-surface p-4 text-sm text-text"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <h4 className="font-semibold text-warning">
            {title ? `Unable to format recipe for "${title}"` : "Unable to format recipe"}
          </h4>
          <p className="text-xs leading-relaxed text-text-muted">
            {message || "The recipe instructions could not be formatted into structured steps. Please try searching for another dish."}
          </p>
        </div>
      </div>
    </div>
  );
}
