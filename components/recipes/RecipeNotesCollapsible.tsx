"use client";

import { useState } from "react";
import { FormattedRecipeNote } from "./RecipeFormattedText";
import RecipeExpandButton from "./RecipeExpandButton";

interface RecipeNotesCollapsibleProps {
  notes: string[];
}

/**
 * Collapsible container for supplementary recipe notes (e.g. Note 1, substitutions)
 * so instructions remain prominent until the user wants to inspect a note.
 */
export default function RecipeNotesCollapsible({
  notes,
}: RecipeNotesCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (notes.length === 0) {
    return null;
  }

  const noteCountLabel = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

  return (
    <div className="space-y-3">
      <RecipeExpandButton
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((prev) => !prev)}
        expandedLabel={`Hide recipe notes (${noteCountLabel})`}
        collapsedLabel={`Show recipe notes (${noteCountLabel})`}
      />

      {isExpanded && (
        <ul className="space-y-2.5">
          {notes.map((note, index) => (
            <li
              key={`note-${index}`}
              className="rounded-xl border border-border/80 bg-background px-3.5 py-3 text-[15px] sm:text-base leading-relaxed text-text break-words"
            >
              <FormattedRecipeNote text={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
