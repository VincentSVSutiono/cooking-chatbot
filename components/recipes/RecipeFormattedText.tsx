import {
  splitIngredientSegments,
  splitRecipeNotePrefix,
  splitStepSegments,
  type RecipeTextSegment,
} from "@/lib/recipes/format-text";

interface SegmentListProps {
  segments: RecipeTextSegment[];
  mainClassName: string;
}

function SegmentList({ segments, mainClassName }: SegmentListProps) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "noteRef") {
          return (
            <span
              key={`note-ref-${index}`}
              className="font-semibold text-accent-strong  decoration-accent-strong/40 "
            >
              {segment.raw}
            </span>
          );
        }

        return (
          <span key={`text-${index}`} className={mainClassName}>
            {segment.value}
          </span>
        );
      })}
    </>
  );
}

/**
 * Formats an ingredient item so the main ingredient stands out while
 * parenthetical clarifications and `(Note ...)` references stay distinct.
 */
export function FormattedIngredientText({ text }: { text: string }) {
  return (
    <SegmentList
      segments={splitIngredientSegments(text)}
      mainClassName="font-medium text-text"
    />
  );
}

/**
 * Formats a cooking step so the main instruction remains crisp while longer
 * parenthetical cooking cues and note references are visually distinct.
 */
export function FormattedRecipeStep({ text }: { text: string }) {
  return (
    <SegmentList segments={splitStepSegments(text)} mainClassName="text-text" />
  );
}

/**
 * Formats a recipe note by emphasizing its leading label (e.g. `Note 1b - Onions:`)
 * before the explanation body.
 */
export function FormattedRecipeNote({ note }: { note: string }) {
  const { prefix, body } = splitRecipeNotePrefix(note);

  if (!prefix) {
    return <span className="text-text">{body}</span>;
  }

  return (
    <>
      <span className="mr-1.5 font-semibold text-accent-strong">{prefix}</span>
      <span className="text-text">{body}</span>
    </>
  );
}
