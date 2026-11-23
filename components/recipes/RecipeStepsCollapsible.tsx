"use client";

import { useState } from "react";
import { FormattedRecipeStep } from "./RecipeFormattedText";
import RecipeExpandButton from "./RecipeExpandButton";

interface RecipeStepsCollapsibleProps {
  steps: string[];
  initialVisibleCount?: number;
}

export default function RecipeStepsCollapsible({
  steps,
  initialVisibleCount = 3,
}: RecipeStepsCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (steps.length === 0) {
    return (
      <p className="text-sm italic text-text-muted">
        No specific steps provided.
      </p>
    );
  }

  const shouldCollapse = steps.length > initialVisibleCount;
  const visibleSteps =
    shouldCollapse && !isExpanded
      ? steps.slice(0, initialVisibleCount)
      : steps;

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {visibleSteps.map((step, index) => (
          <li
            key={index}
            className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/70 p-3.5 sm:p-4 text-[15px] sm:text-base text-text"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs sm:text-sm font-bold text-accent-strong"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 leading-relaxed break-words">
              <FormattedRecipeStep text={step} />
            </span>
          </li>
        ))}
      </ol>

      {shouldCollapse && (
        <RecipeExpandButton
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded((prev) => !prev)}
          expandedLabel="Show fewer steps"
          collapsedLabel={`Show all ${steps.length} steps (${steps.length - initialVisibleCount} more)`}
        />
      )}
    </div>
  );
}
