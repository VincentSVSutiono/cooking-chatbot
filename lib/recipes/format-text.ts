export type RecipeTextSegment =
  | { kind: "text"; value: string }
  | { kind: "paren"; value: string }
  | { kind: "noteRef"; value: string; raw: string };

const NOTE_REFERENCE_PATTERN =
  /^(?:see\s+)?notes?\s+\d+[a-z]?(?:\s*(?:,|&|and)\s*\d+[a-z]?)*$/i;

const UNIT_OR_NUMERIC_PATTERN =
  /^\d+(?:[./-]\d+)?\s*(?:°|c\b|f\b|g\b|kg\b|ml\b|l\b|oz\b|lb|tsp|tbsp|cup|min|hr)/i;

const NOTE_PREFIX_PATTERN =
  /^(Notes?\s+\d+[a-z]?(?:\s*\([^)]+\)|\s*[-–—]\s*[^:]{1,35})?\s*[:.]|\d+[a-z]?[.):])\s+([\s\S]+)$/i;

const SHORT_HEADING_PREFIX_PATTERN = /^([A-Z][A-Za-z0-9\s/-]{1,28}:)\s+([\s\S]+)$/;

function pushMergedText(
  segments: RecipeTextSegment[],
  text: string,
): void {
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === "text") {
    last.value += text;
    return;
  }
  segments.push({ kind: "text", value: text });
}

function splitParentheticalSegments(
  input: string,
  treatOtherParenAsCue: (innerText: string) => boolean,
): RecipeTextSegment[] {
  if (!input) return [{ kind: "text", value: "" }];

  const segments: RecipeTextSegment[] = [];
  const parenRegex = /\(([^()]+)\)/g;
  let lastIndex = 0;

  for (const match of input.matchAll(parenRegex)) {
    const matchIndex = match.index ?? 0;
    const raw = match[0];
    const inner = match[1].trim();

    if (matchIndex > lastIndex) {
      pushMergedText(segments, input.slice(lastIndex, matchIndex));
    }

    if (NOTE_REFERENCE_PATTERN.test(inner)) {
      segments.push({ kind: "noteRef", value: inner, raw });
    } else if (treatOtherParenAsCue(inner)) {
      segments.push({ kind: "paren", value: raw });
    } else {
      pushMergedText(segments, raw);
    }

    lastIndex = matchIndex + raw.length;
  }

  if (lastIndex < input.length) {
    pushMergedText(segments, input.slice(lastIndex));
  }

  return segments.length > 0 ? segments : [{ kind: "text", value: input }];
}

/**
 * Splits an ingredient description into main text, note references (e.g. `(Note 1b)`),
 * and parenthetical clarifications so UI can emphasize the main ingredient name.
 */
export function splitIngredientSegments(text: string): RecipeTextSegment[] {
  return splitParentheticalSegments(text, () => true);
}

/**
 * Splits a cooking step into action text, explanatory parenthetical cues,
 * and note references while keeping numeric/unit conversions as regular text.
 */
export function splitStepSegments(text: string): RecipeTextSegment[] {
  return splitParentheticalSegments(
    text,
    (inner) =>
      inner.length >= 6 &&
      !UNIT_OR_NUMERIC_PATTERN.test(inner) &&
      inner.split(/\s+/).length >= 2,
  );
}

/**
 * Splits a recipe note into an optional leading label (e.g. `Note 1b - Onions:`,
 * `Storage:`, or `2.`) and its explanation body for clearer scannability.
 */
export function splitRecipeNotePrefix(note: string): {
  prefix: string | null;
  body: string;
} {
  const trimmed = note.trim();
  const explicitMatch = NOTE_PREFIX_PATTERN.exec(trimmed);
  if (explicitMatch) {
    return {
      prefix: explicitMatch[1].trim(),
      body: explicitMatch[2].trim(),
    };
  }

  const headingMatch = SHORT_HEADING_PREFIX_PATTERN.exec(trimmed);
  if (headingMatch && !/[.,!?]/.test(headingMatch[1])) {
    return {
      prefix: headingMatch[1].trim(),
      body: headingMatch[2].trim(),
    };
  }

  return {
    prefix: null,
    body: trimmed,
  };
}
