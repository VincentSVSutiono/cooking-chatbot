import "server-only";
import { embed, embedMany } from "ai";
import type { GoogleEmbeddingModelOptions } from "@ai-sdk/google";
import { EMBEDDING_DIMENSIONS, getEmbeddingModel } from "@/config/ai";
import type { RecipeIngredient } from "@/lib/recipes/schema";

const MAX_INSTRUCTION_CHARS = 600;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbeddingRecipeInput {
  title: string;
  category?: string | null;
  area?: string | null;
  ingredients: RecipeIngredient[];
  instructions: string;
}

export interface EmbedCallOptions {
  taskType: EmbeddingTaskType;
  dimensions: number;
}

export interface EmbedderOptions {
  embedFn?: (value: string, options: EmbedCallOptions) => Promise<number[]>;
  embedManyFn?: (
    values: string[],
    options: EmbedCallOptions,
  ) => Promise<number[][]>;
}

/**
 * Normalizes a vector to unit L2 length after validating dimension count and finite values.
 * Needed because Matryoshka-truncated Gemini embeddings are not always unit-normalized.
 */
export function normalizeVector(
  vector: number[],
  expectedDimensions: number = EMBEDDING_DIMENSIONS,
): number[] {
  if (vector.length !== expectedDimensions) {
    throw new Error(
      `Expected embedding of ${expectedDimensions} dimensions, received ${vector.length}.`,
    );
  }

  let sumSquares = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding vector contains a non-finite number.");
    }
    sumSquares += value * value;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    throw new Error("Cannot normalize a zero-norm embedding vector.");
  }

  return vector.map((value) => value / norm);
}

/**
 * Formats a recipe's key semantic fields into a compact canonical string for embedding.
 */
export function formatRecipeForEmbedding(recipe: EmbeddingRecipeInput): string {
  const title = recipe.title.trim();
  if (!title) {
    throw new Error("Cannot format recipe for embedding without a title.");
  }

  const category = recipe.category?.trim() || "Uncategorized";
  const area = recipe.area?.trim() || "Global";
  const ingredientNames = recipe.ingredients
    .map((ingredient) => ingredient.item.trim())
    .filter((item) => item.length > 0)
    .join(", ");
  const instructions = recipe.instructions
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_INSTRUCTION_CHARS);

  return [
    `Title: ${title}`,
    `Category: ${category} | Cuisine: ${area}`,
    `Ingredients: ${ingredientNames || "None listed"}`,
    `Instructions: ${instructions || "None listed"}`,
  ].join("\n");
}

function buildGoogleEmbeddingOptions(
  taskType: EmbeddingTaskType,
): { google: GoogleEmbeddingModelOptions } {
  return {
    google: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType,
    },
  };
}

async function embedSingleText(
  value: string,
  taskType: EmbeddingTaskType,
  options?: EmbedderOptions,
): Promise<number[]> {
  const callOptions: EmbedCallOptions = {
    taskType,
    dimensions: EMBEDDING_DIMENSIONS,
  };

  const rawVector = options?.embedFn
    ? await options.embedFn(value, callOptions)
    : (
        await embed({
          model: getEmbeddingModel(),
          value,
          providerOptions: buildGoogleEmbeddingOptions(taskType),
        })
      ).embedding;

  return normalizeVector(rawVector);
}

export async function embedRecipeDocument(
  recipe: EmbeddingRecipeInput,
  options?: EmbedderOptions,
): Promise<number[]> {
  const formatted = formatRecipeForEmbedding(recipe);
  return embedSingleText(formatted, "RETRIEVAL_DOCUMENT", options);
}

export async function embedSearchQuery(
  query: string,
  options?: EmbedderOptions,
): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Cannot embed an empty search query.");
  }

  return embedSingleText(trimmed, "RETRIEVAL_QUERY", options);
}

// ============================================================================
// CLI Seeding Helper (not called by the live chat app)
// ============================================================================

export async function embedRecipeDocumentsBatch(
  recipes: EmbeddingRecipeInput[],
  options?: EmbedderOptions,
): Promise<number[][]> {
  if (recipes.length === 0) {
    return [];
  }

  const formattedValues = recipes.map(formatRecipeForEmbedding);
  const callOptions: EmbedCallOptions = {
    taskType: "RETRIEVAL_DOCUMENT",
    dimensions: EMBEDDING_DIMENSIONS,
  };

  const rawVectors = options?.embedManyFn
    ? await options.embedManyFn(formattedValues, callOptions)
    : (
        await embedMany({
          model: getEmbeddingModel(),
          values: formattedValues,
          providerOptions: buildGoogleEmbeddingOptions("RETRIEVAL_DOCUMENT"),
        })
      ).embeddings;

  if (rawVectors.length !== recipes.length) {
    throw new Error(
      `Expected ${recipes.length} embeddings, received ${rawVectors.length}.`,
    );
  }

  return rawVectors.map((vector) => normalizeVector(vector));
}
