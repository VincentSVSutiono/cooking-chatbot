import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatModel } from "@/config/ai";
import { THEMEALDB_CREDIT_TEXT, type NormalizedMealDbRecipe } from "./mealdb";
import type { ExtractedUrlRecipe } from "./url-import";
import {
  validateRecipe,
  RecipeIngredientSchema,
  type StructuredRecipe,
} from "./schema";

export type GetRecipeOutput =
  | { status: "success"; recipe: StructuredRecipe }
  | {
      status: "validation-error";
      id: string;
      title?: string;
      message: string;
    }
  | {
      status: "not-found";
      id: string;
      title?: string;
      message: string;
    };

export type ImportUrlRecipeOutput =
  | { status: "success"; recipe: StructuredRecipe }
  | { status: "not-a-recipe"; url: string; title?: string; message: string }
  | { status: "fetch-error"; url: string; title?: string; message: string }
  | {
      status: "validation-error";
      url: string;
      title?: string;
      message: string;
    };

const NonEmptyString = z.string().trim().min(1);

export const MealDbRecipeBreakdownSchema = z.object({
  steps: z
    .array(NonEmptyString)
    .min(1)
    .describe(
      "Break the raw recipe instructions into clear, ordered, beginner-friendly steps without omitting source details. " +
        "When a cooking term appears (e.g. simmer, sauté, fold, al dente), briefly explain what it looks or sounds like in parentheses. " +
        "Do NOT invent any ingredients, quantities, cooking times, or temperatures not stated in the raw instructions.",
    ),
  times: z.object({
    prep: NonEmptyString.nullable().describe(
      "Preparation, chilling, or marinating time ONLY if explicitly stated in the raw instructions (e.g. '15 minutes'). Otherwise null.",
    ),
    cook: NonEmptyString.nullable().describe(
      "Cooking, baking, frying, or simmering time ONLY if explicitly stated in the raw instructions (e.g. '30 minutes'). Otherwise null.",
    ),
    total: NonEmptyString.nullable().describe(
      "Total time ONLY if explicitly stated in the raw instructions or directly summed from stated prep + cook times. Otherwise null.",
    ),
  }),
  safetyNote: NonEmptyString.nullable().describe(
    "A food-safety or hot-handling caution ONLY if explicitly mentioned in the raw instructions (e.g. 'ensure chicken juices run clear', 'careful with hot oil'). Do NOT invent temperatures. Otherwise null.",
  ),
});

export async function structureMealDbRecipe(
  normalizedRecipe: NormalizedMealDbRecipe,
  modelId?: string,
): Promise<GetRecipeOutput> {
  try {
    const prompt = `Convert the following raw recipe instructions for "${normalizedRecipe.title}" into beginner-friendly steps, times, and safetyNote.
Strictly follow the source text and never invent times, temperatures, or amounts.
Raw instructions:
${normalizedRecipe.instructions}`;

    const { output } = await generateText({
      model: getChatModel(modelId),
      output: Output.object({ schema: MealDbRecipeBreakdownSchema }),
      prompt,
    });

    const candidateRecipe = {
      id: normalizedRecipe.id,
      title: normalizedRecipe.title,
      ingredients: normalizedRecipe.ingredients,
      steps: output.steps,
      times: output.times,
      safetyNote: output.safetyNote,
      source: {
        name: "TheMealDB",
        url: normalizedRecipe.sourceUrl,
        creditText: THEMEALDB_CREDIT_TEXT,
        thumbnailUrl: normalizedRecipe.thumbnailUrl,
        youtubeUrl: normalizedRecipe.youtubeUrl,
        category: normalizedRecipe.category,
        area: normalizedRecipe.area,
      },
    };

    const validation = validateRecipe(candidateRecipe);
    if (!validation.success) {
      return {
        status: "validation-error",
        id: normalizedRecipe.id,
        title: normalizedRecipe.title,
        message: validation.error,
      };
    }

    return {
      status: "success",
      recipe: validation.data,
    };
  } catch (error) {
    console.error("Failed to structure MealDB recipe:", error);
    return {
      status: "validation-error",
      id: normalizedRecipe.id,
      title: normalizedRecipe.title,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate structured recipe output.",
    };
  }
}

export const UrlRecipeBreakdownSchema = z.object({
  isRecipe: z
    .boolean()
    .describe(
      "True ONLY if the source content contains an actual recipe with both ingredients and cooking instructions. False for non-recipe pages.",
    ),
  title: NonEmptyString.nullable().describe(
    "Recipe title from the source, or null if isRecipe is false.",
  ),
  ingredients: z
    .array(RecipeIngredientSchema)
    .describe(
      "Each ingredient split into item (e.g. 'all-purpose flour') and stated amount (e.g. '1 1/2 cups', or '' if none stated). Never invent amounts.",
    ),
  steps: z
    .array(NonEmptyString)
    .describe(
      "Keep all instructions from the source in clear, ordered, beginner-friendly steps, preserving all stated ingredients, actions, times, temperatures, and note references (e.g. '(Note 1b)'). " +
        "When a cooking term appears (e.g. simmer, sauté, fold, al dente), briefly explain what it looks or sounds like in parentheses. " +
        "Do NOT invent any ingredients, quantities, cooking times, or temperatures not stated in the source. Empty array if isRecipe is false.",
    ),
  times: MealDbRecipeBreakdownSchema.shape.times,
  safetyNote: MealDbRecipeBreakdownSchema.shape.safetyNote,
  notes: z
    .array(NonEmptyString)
    .describe(
      "Include EVERY single recipe note, sub-note (e.g. Note 1, Note 1b, Note 2 ... Note 14), ingredient clarification, and substitution from the source—never truncate or skip notes. " +
        "Start labeled notes cleanly with their original label (e.g. 'Note 1b (Onions): ...') and you may tighten the wording as long as the full point is retained. Empty array if none are stated in the source.",
    ),
});

export async function structureUrlRecipe(
  extractedRecipe: ExtractedUrlRecipe,
  modelId?: string,
): Promise<ImportUrlRecipeOutput> {
  try {
    const sharedRules = [
      "Keep every recipe note or substitution referenced by ingredients/steps (e.g. Note 1, Note 1b) in the notes array without inventing details.",
      "Strictly follow the source text and never invent ingredients, amounts, cooking times, or temperatures.",
    ].join("\n");

    const prompt =
      extractedRecipe.mode === "json-ld"
        ? `Format this pre-extracted recipe data (already confirmed to be a recipe) into beginner-friendly steps, split { item, amount } ingredients, notes, times, and safetyNote.
Set isRecipe to true unless the data is clearly missing ingredients or instructions.
${sharedRules}

Title: ${extractedRecipe.title}
Ingredients:
${extractedRecipe.ingredients.map((i) => `- ${i}`).join("\n")}
Raw Instructions:
${extractedRecipe.instructions}${extractedRecipe.notesText ? `\nRecipe Notes:\n${extractedRecipe.notesText}` : ""}`
        : `Extract and structure a recipe from the following webpage text into title, ingredients, beginner-friendly steps, notes, times, and safetyNote.
If the page does not contain a real recipe with both ingredients and instructions, set isRecipe to false.
${sharedRules}

Page Title: ${extractedRecipe.title}
Page Content:
${extractedRecipe.textSnippet}`;

    const { output } = await generateText({
      model: getChatModel(modelId),
      output: Output.object({ schema: UrlRecipeBreakdownSchema }),
      prompt,
    });

    if (!output.isRecipe || !output.title) {
      return {
        status: "not-a-recipe",
        url: extractedRecipe.sourceUrl,
        title: extractedRecipe.title,
        message: `The page at ${extractedRecipe.siteName} does not appear to contain a complete recipe with ingredients and instructions.`,
      };
    }

    const candidateRecipe = {
      id: `url-${encodeURIComponent(extractedRecipe.sourceUrl).slice(0, 64)}`,
      title:
        extractedRecipe.mode === "json-ld"
          ? extractedRecipe.title
          : output.title,
      ingredients: output.ingredients,
      steps: output.steps,
      times: {
        prep:
          extractedRecipe.mode === "json-ld"
            ? (extractedRecipe.prepTime ?? output.times.prep)
            : output.times.prep,
        cook:
          extractedRecipe.mode === "json-ld"
            ? (extractedRecipe.cookTime ?? output.times.cook)
            : output.times.cook,
        total:
          extractedRecipe.mode === "json-ld"
            ? (extractedRecipe.totalTime ?? output.times.total)
            : output.times.total,
      },
      safetyNote: output.safetyNote,
      ...(output.notes.length > 0 ? { notes: output.notes } : {}),
      source: {
        name: extractedRecipe.siteName,
        url: extractedRecipe.sourceUrl,
        creditText: `Recipe imported from ${extractedRecipe.siteName} (${extractedRecipe.sourceUrl})`,
        thumbnailUrl:
          extractedRecipe.mode === "json-ld"
            ? extractedRecipe.thumbnailUrl
            : null,
        youtubeUrl: extractedRecipe.youtubeUrl,
        category:
          extractedRecipe.mode === "json-ld" ? extractedRecipe.category : null,
        area: extractedRecipe.mode === "json-ld" ? extractedRecipe.area : null,
      },
    };

    const validation = validateRecipe(candidateRecipe);
    if (!validation.success) {
      return {
        status: "validation-error",
        url: extractedRecipe.sourceUrl,
        title: extractedRecipe.title,
        message: validation.error,
      };
    }

    return {
      status: "success",
      recipe: validation.data,
    };
  } catch (error) {
    console.error("Failed to structure URL recipe:", error);
    return {
      status: "validation-error",
      url: extractedRecipe.sourceUrl,
      title: extractedRecipe.title,
      message:
        error instanceof Error
          ? error.message
          : "Failed to structure imported URL recipe.",
    };
  }
}
