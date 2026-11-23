import {
  splitRecipeNote,
  splitRecipeNoteRefs,
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
              className="font-semibold text-accent-strong"
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
 * Formats an ingredient item so `(Note ...)` references stand out while keeping
 * the rest of the ingredient text uniform.
 */
export function FormattedRecipeIngredient({ text }: { text: string }) {
  return (
    <SegmentList
      segments={splitRecipeNoteRefs(text)}
      mainClassName="font-medium text-text"
    />
  );
}

/**
 * Formats a cooking step so `(Note ...)` references stand out while keeping
 * instructions and parenthetical cues in the same text style.
 */
export function FormattedRecipeStep({ text }: { text: string }) {
  return (
    <SegmentList segments={splitRecipeNoteRefs(text)} mainClassName="text-text" />
  );
}

/**
 * Formats a recipe note by emphasizing its leading label (e.g. `Note 1b - Onions:`)
 * before the explanation body.
 */
export function FormattedRecipeNote({ text }: { text: string }) {
  const { prefix, body } = splitRecipeNote(text);

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
