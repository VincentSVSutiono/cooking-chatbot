import { describe, expect, it } from "vitest";
import { splitRecipeNote, splitRecipeNoteRefs } from "../format-text";

describe("splitRecipeNoteRefs", () => {
  it("extracts note references like (Note 1b) as noteRef segments while keeping surrounding text", () => {
    const segments = splitRecipeNoteRefs(
      "small onion, finely chopped (Note 1b)",
    );

    expect(segments).toEqual([
      { kind: "text", value: "small onion, finely chopped " },
      { kind: "noteRef", value: "Note 1b", raw: "(Note 1b)" },
    ]);
  });

  it("keeps other parenthetical clarifications merged into plain text", () => {
    const input =
      "Simmer gently (tiny bubbles breaking slowly) for 15 minutes (2 tbsp left) (Note 2).";
    const segments = splitRecipeNoteRefs(input);

    expect(segments).toEqual([
      {
        kind: "text",
        value:
          "Simmer gently (tiny bubbles breaking slowly) for 15 minutes (2 tbsp left) ",
      },
      { kind: "noteRef", value: "Note 2", raw: "(Note 2)" },
      { kind: "text", value: "." },
    ]);
    expect(
      segments.map((s) => ("raw" in s ? s.raw : s.value)).join(""),
    ).toBe(input);
  });

  it("returns a single text segment when there are no note references", () => {
    expect(splitRecipeNoteRefs("garlic, minced (or crushed)")).toEqual([
      { kind: "text", value: "garlic, minced (or crushed)" },
    ]);
  });
});

describe("splitRecipeNote", () => {
  it("extracts explicit Note labels with optional sub-titles", () => {
    expect(
      splitRecipeNote(
        "Note 1b - Onions: Use yellow or brown onions for sweetness.",
      ),
    ).toEqual({
      prefix: "Note 1b - Onions:",
      body: "Use yellow or brown onions for sweetness.",
    });

    expect(
      splitRecipeNote("Note 3 (Coconut): Desiccated works best."),
    ).toEqual({
      prefix: "Note 3 (Coconut):",
      body: "Desiccated works best.",
    });
  });

  it("extracts short labeled headings and numbered prefixes", () => {
    expect(
      splitRecipeNote("Storage: Keeps in the fridge for 4 days."),
    ).toEqual({
      prefix: "Storage:",
      body: "Keeps in the fridge for 4 days.",
    });

    expect(
      splitRecipeNote("2. Toast the coconut gently until golden."),
    ).toEqual({
      prefix: "2.",
      body: "Toast the coconut gently until golden.",
    });
  });

  it("returns null prefix for unlabeled plain sentences", () => {
    const plain =
      "If the curry sticks slightly, turn down the heat and stir well.";
    expect(splitRecipeNote(plain)).toEqual({
      prefix: null,
      body: plain,
    });
  });
});
