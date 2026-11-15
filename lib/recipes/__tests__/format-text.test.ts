import { describe, expect, it } from "vitest";
import {
  splitIngredientSegments,
  splitStepSegments,
  splitRecipeNotePrefix,
} from "../format-text";

describe("splitIngredientSegments", () => {
  it("extracts note references like (Note 1b) as noteRef segments while keeping surrounding text", () => {
    const segments = splitIngredientSegments(
      "small onion, finely chopped (Note 1b)",
    );

    expect(segments).toEqual([
      { kind: "text", value: "small onion, finely chopped " },
      { kind: "noteRef", value: "Note 1b", raw: "(Note 1b)" },
    ]);
  });

  it("extracts parenthetical clarifications as paren segments and preserves exact text", () => {
    const input = "large kaffir lime leaves (or 6 small), very thinly sliced";
    const segments = splitIngredientSegments(input);

    expect(segments).toEqual([
      { kind: "text", value: "large kaffir lime leaves " },
      { kind: "paren", value: "(or 6 small)" },
      { kind: "text", value: ", very thinly sliced" },
    ]);
    expect(
      segments.map((s) => ("raw" in s ? s.raw : s.value)).join(""),
    ).toBe(input);
  });

  it("returns a single text segment when there are no parentheticals", () => {
    expect(splitIngredientSegments("garlic, minced")).toEqual([
      { kind: "text", value: "garlic, minced" },
    ]);
  });
});

describe("splitStepSegments", () => {
  it("separates explanatory cues in parentheses from core action text and keeps unit conversions normal", () => {
    const input =
      "Simmer gently (tiny bubbles breaking slowly around the edges) for 15 minutes (2 tbsp liquid left) (Note 2).";
    const segments = splitStepSegments(input);

    expect(segments).toEqual([
      { kind: "text", value: "Simmer gently " },
      {
        kind: "paren",
        value: "(tiny bubbles breaking slowly around the edges)",
      },
      { kind: "text", value: " for 15 minutes (2 tbsp liquid left) " },
      { kind: "noteRef", value: "Note 2", raw: "(Note 2)" },
      { kind: "text", value: "." },
    ]);
  });
});

describe("splitRecipeNotePrefix", () => {
  it("extracts explicit Note labels with optional sub-titles", () => {
    expect(
      splitRecipeNotePrefix(
        "Note 1b - Onions: Use yellow or brown onions for sweetness.",
      ),
    ).toEqual({
      prefix: "Note 1b - Onions:",
      body: "Use yellow or brown onions for sweetness.",
    });

    expect(
      splitRecipeNotePrefix("Note 3 (Coconut): Desiccated works best."),
    ).toEqual({
      prefix: "Note 3 (Coconut):",
      body: "Desiccated works best.",
    });
  });

  it("extracts short labeled headings and numbered prefixes", () => {
    expect(
      splitRecipeNotePrefix("Storage: Keeps in the fridge for 4 days."),
    ).toEqual({
      prefix: "Storage:",
      body: "Keeps in the fridge for 4 days.",
    });

    expect(
      splitRecipeNotePrefix("2. Toast the coconut gently until golden."),
    ).toEqual({
      prefix: "2.",
      body: "Toast the coconut gently until golden.",
    });
  });

  it("returns null prefix for unlabeled plain sentences", () => {
    const plain =
      "If the curry sticks slightly, turn down the heat and stir well.";
    expect(splitRecipeNotePrefix(plain)).toEqual({
      prefix: null,
      body: plain,
    });
  });
});
