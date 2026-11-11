"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface RecipeStepsCollapsibleProps {
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
          <li key={index} className="flex items-start gap-3 text-base text-text">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-accent-strong"
            >
              {index + 1}
            </span>
            <span className="flex-1 leading-relaxed break-words">{step}</span>
          </li>
        ))}
      </ol>

      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 text-accent-strong" aria-hidden="true" />
              <span>Show fewer steps</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 text-accent-strong" aria-hidden="true" />
              <span>Show all {steps.length} steps ({steps.length - initialVisibleCount} more)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
