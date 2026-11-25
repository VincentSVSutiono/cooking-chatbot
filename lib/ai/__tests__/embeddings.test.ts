import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { EMBEDDING_DIMENSIONS } from "@/config/ai";
import {
  embedRecipeDocument,
  embedRecipeDocumentsBatch,
  embedSearchQuery,
  formatRecipeForEmbedding,
  normalizeVector,
  type EmbeddingRecipeInput,
} from "@/lib/ai/embeddings";

function makeVector(fillValue: number, length = EMBEDDING_DIMENSIONS): number[] {
  return Array.from({ length }, () => fillValue);
}

function vectorNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

const sampleRecipe: EmbeddingRecipeInput = {
  title: "Teriyaki Chicken Casserole",
  category: "Chicken",
  area: "Japanese",
  ingredients: [
    { item: "soy sauce", amount: "3/4 cup" },
    { item: "brown sugar", amount: "1/2 cup" },
    { item: "chicken breasts", amount: "2" },
  ],
  instructions: "Preheat oven to 350F.\r\n\r\nBake chicken for 30 minutes.",
};

describe("normalizeVector", () => {
  it("normalizes a 768-dimension vector to unit L2 length", () => {
    const raw = makeVector(2);
    const normalized = normalizeVector(raw);

    expect(normalized).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vectorNorm(normalized)).toBeCloseTo(1, 6);
    expect(normalized[0]).toBeCloseTo(1 / Math.sqrt(EMBEDDING_DIMENSIONS), 6);
  });

  it("throws when vector dimensions do not match expectedDimensions", () => {
    expect(() => normalizeVector([1, 2, 3])).toThrow(/768 dimensions/i);
  });

  it("throws on zero-norm vectors", () => {
    expect(() => normalizeVector(makeVector(0))).toThrow(/zero-norm/i);
  });

  it("throws on non-finite values", () => {
    const bad = makeVector(1);
    bad[10] = Number.NaN;
    expect(() => normalizeVector(bad)).toThrow(/non-finite/i);
  });
});

describe("formatRecipeForEmbedding", () => {
  it("formats title, category, cuisine, ingredient items, and collapsed instructions", () => {
    const formatted = formatRecipeForEmbedding(sampleRecipe);

    expect(formatted).toBe(
      [
        "Title: Teriyaki Chicken Casserole",
        "Category: Chicken | Cuisine: Japanese",
        "Ingredients: soy sauce, brown sugar, chicken breasts",
        "Instructions: Preheat oven to 350F. Bake chicken for 30 minutes.",
      ].join("\n"),
    );
  });

  it("uses Uncategorized and Global fallbacks and caps instructions at 600 chars", () => {
    const longInstructions = "Stir gently. ".repeat(100);
    const formatted = formatRecipeForEmbedding({
      title: "Simple Broth",
      category: null,
      area: "  ",
      ingredients: [{ item: "water", amount: "4 cups" }],
      instructions: longInstructions,
    });

    const lines = formatted.split("\n");
    expect(lines[1]).toBe("Category: Uncategorized | Cuisine: Global");
    const instructionsContent = lines[3].replace("Instructions: ", "");
    expect(instructionsContent.length).toBeLessThanOrEqual(600);
  });

  it("throws when recipe title is blank", () => {
    expect(() =>
      formatRecipeForEmbedding({
        ...sampleRecipe,
        title: "   ",
      }),
    ).toThrow(/title/i);
  });
});

describe("embedRecipeDocument", () => {
  it("embeds formatted recipe with RETRIEVAL_DOCUMENT and normalizes the result", async () => {
    let capturedValue = "";
    let capturedOptions: unknown = null;

    const vector = await embedRecipeDocument(sampleRecipe, {
      embedFn: async (value, options) => {
        capturedValue = value;
        capturedOptions = options;
        return makeVector(3);
      },
    });

    expect(capturedValue).toContain("Title: Teriyaki Chicken Casserole");
    expect(capturedOptions).toEqual({
      taskType: "RETRIEVAL_DOCUMENT",
      dimensions: EMBEDDING_DIMENSIONS,
    });
    expect(vectorNorm(vector)).toBeCloseTo(1, 6);
  });
});

describe("embedRecipeDocumentsBatch", () => {
  it("returns an empty array without calling embedManyFn when given no recipes", async () => {
    const embedManyFn = vi.fn();
    const result = await embedRecipeDocumentsBatch([], { embedManyFn });

    expect(result).toEqual([]);
    expect(embedManyFn).not.toHaveBeenCalled();
  });

  it("embeds a batch of recipes with RETRIEVAL_DOCUMENT and normalizes every vector", async () => {
    let capturedValues: string[] = [];
    let capturedOptions: unknown = null;

    const vectors = await embedRecipeDocumentsBatch(
      [
        sampleRecipe,
        {
          ...sampleRecipe,
          title: "Miso Soup",
          ingredients: [{ item: "miso paste", amount: "2 tbsp" }],
        },
      ],
      {
        embedManyFn: async (values, options) => {
          capturedValues = values;
          capturedOptions = options;
          return [makeVector(2), makeVector(5)];
        },
      },
    );

    expect(capturedValues).toHaveLength(2);
    expect(capturedValues[0]).toContain("Title: Teriyaki Chicken Casserole");
    expect(capturedValues[1]).toContain("Title: Miso Soup");
    expect(capturedOptions).toEqual({
      taskType: "RETRIEVAL_DOCUMENT",
      dimensions: EMBEDDING_DIMENSIONS,
    });
    expect(vectors).toHaveLength(2);
    expect(vectorNorm(vectors[0])).toBeCloseTo(1, 6);
    expect(vectorNorm(vectors[1])).toBeCloseTo(1, 6);
  });

  it("throws if embedManyFn returns a mismatched number of vectors", async () => {
    await expect(
      embedRecipeDocumentsBatch([sampleRecipe], {
        embedManyFn: async () => [],
      }),
    ).rejects.toThrow(/Expected 1 embeddings, received 0/i);
  });
});

describe("embedSearchQuery", () => {
  it("trims the query, uses RETRIEVAL_QUERY, and normalizes the vector", async () => {
    let capturedValue = "";
    let capturedOptions: unknown = null;

    const vector = await embedSearchQuery("  warm chicken soup  ", {
      embedFn: async (value, options) => {
        capturedValue = value;
        capturedOptions = options;
        return makeVector(4);
      },
    });

    expect(capturedValue).toBe("warm chicken soup");
    expect(capturedOptions).toEqual({
      taskType: "RETRIEVAL_QUERY",
      dimensions: EMBEDDING_DIMENSIONS,
    });
    expect(vectorNorm(vector)).toBeCloseTo(1, 6);
  });

  it("rejects empty queries without calling embedFn", async () => {
    const embedFn = vi.fn();

    await expect(embedSearchQuery("   ", { embedFn })).rejects.toThrow(
      /empty search query/i,
    );
    expect(embedFn).not.toHaveBeenCalled();
  });
});
