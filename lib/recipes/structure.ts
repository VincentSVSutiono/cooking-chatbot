import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatModel } from "@/config/ai";
import type { NormalizedRecipe } from "./search";
import type { ExtractedWebRecipeCandidate } from "./url-import";
import {
  validateRecipe,
  RecipeIngredientSchema,
  type RecipeValidationResult,
  type StructuredRecipe,
} from "./schema";

export const THEMEALDB_CREDIT_TEXT =
  "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)";

const NonEmptyString = z.string().trim().min(1);

export const InstructionBreakdownSchema = z.object({
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

export async function structureNormalizedRecipe(
  rawRecipe: NormalizedRecipe,
  modelId?: string,
): Promise<RecipeValidationResult> {
  try {
    const prompt = `Convert the following raw recipe instructions for "${rawRecipe.name}" into beginner-friendly steps, times, and safetyNote.
Strictly follow the source text and never invent times, temperatures, or amounts.
Raw instructions:
${rawRecipe.instructions}`;

    const { output } = await generateText({
      model: getChatModel(modelId),
      output: Output.object({ schema: InstructionBreakdownSchema }),
      prompt,
    });

    const candidateRecipe = {
      id: rawRecipe.id,
      title: rawRecipe.name,
      ingredients: rawRecipe.ingredients.map((ing) => ({
        item: ing.item,
        amount: ing.measure,
      })),
      steps: output.steps,
      times: output.times,
      safetyNote: output.safetyNote,
      source: {
        name: "TheMealDB",
        url: rawRecipe.mealUrl,
        creditText: THEMEALDB_CREDIT_TEXT,
        thumbnailUrl: rawRecipe.thumbnailUrl,
        youtubeUrl: rawRecipe.youtubeUrl,
        category: rawRecipe.category,
        area: rawRecipe.area,
      },
    };

    return validateRecipe(candidateRecipe);
  } catch (error) {
    console.error("Failed to structure recipe:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate structured recipe output.",
    };
  }
}

export const ImportedRecipeBreakdownSchema = z.object({
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
  times: InstructionBreakdownSchema.shape.times,
  safetyNote: InstructionBreakdownSchema.shape.safetyNote,
  notes: z
    .array(NonEmptyString)
    .describe(
      "Include EVERY single recipe note, sub-note (e.g. Note 1, Note 1b, Note 2 ... Note 14), ingredient clarification, and substitution from the source—never truncate or skip notes. " +
        "Start labeled notes cleanly with their original label (e.g. 'Note 1b (Onions): ...') and you may tighten the wording as long as the full point is retained. Empty array if none are stated in the source.",
    ),
});

export type StructureImportedRecipeResult =
  | { status: "success"; recipe: StructuredRecipe }
  | { status: "not-a-recipe"; message: string }
  | { status: "validation-error"; message: string };

export async function structureImportedRecipe(
  candidate: ExtractedWebRecipeCandidate,
  modelId?: string,
): Promise<StructureImportedRecipeResult> {
  try {
    const notesBlock =
      candidate.mode === "json-ld" && candidate.notesText
        ? `\nRecipe Notes:\n${candidate.notesText}`
        : "";
    const sourceContent =
      candidate.mode === "json-ld"
        ? `Mode: Structured JSON-LD Recipe
Title: ${candidate.title}
Ingredients:
${candidate.ingredients.map((i) => `- ${i}`).join("\n")}
Raw Instructions:
${candidate.rawInstructions}${notesBlock}`
        : `Mode: Webpage Text
Page Title: ${candidate.title}
Page Content:
${candidate.textSnippet}`;

    const { output } = await generateText({
      model: getChatModel(modelId),
      output: Output.object({ schema: ImportedRecipeBreakdownSchema }),
      prompt: `Extract and structure the recipe from this webpage into beginner-friendly steps, ingredients, notes, times, and safetyNote.
If the page does not contain a real recipe with both ingredients and instructions, set isRecipe to false.
Keep any recipe notes or substitutions referenced by ingredients/steps (e.g. Note 1, Note 1b) in the notes array without inventing details.
Strictly follow the source text and never invent ingredients, amounts, cooking times, or temperatures.

${sourceContent}`,
    });

    if (!output.isRecipe || !output.title) {
      return {
        status: "not-a-recipe",
        message: `The page at ${candidate.siteName} does not appear to contain a complete recipe with ingredients and instructions.`,
      };
    }

    const candidateRecipe = {
      id: `url-${encodeURIComponent(candidate.pageUrl).slice(0, 64)}`,
      title: candidate.mode === "json-ld" ? candidate.title : output.title,
      ingredients: output.ingredients,
      steps: output.steps,
      times: {
        prep:
          candidate.mode === "json-ld"
            ? (candidate.prepTime ?? output.times.prep)
            : output.times.prep,
        cook:
          candidate.mode === "json-ld"
            ? (candidate.cookTime ?? output.times.cook)
            : output.times.cook,
        total:
          candidate.mode === "json-ld"
            ? (candidate.totalTime ?? output.times.total)
            : output.times.total,
      },
      safetyNote: output.safetyNote,
      ...(output.notes.length > 0 ? { notes: output.notes } : {}),
      source: {
        name: candidate.siteName,
        url: candidate.pageUrl,
        creditText: `Recipe imported from ${candidate.siteName} (${candidate.pageUrl})`,
        thumbnailUrl: candidate.mode === "json-ld" ? candidate.imageUrl : null,
        youtubeUrl: candidate.youtubeUrl,
        category: candidate.mode === "json-ld" ? candidate.category : null,
        area: candidate.mode === "json-ld" ? candidate.area : null,
      },
    };

    const validation = validateRecipe(candidateRecipe);
    if (!validation.success) {
      return {
        status: "validation-error",
        message: validation.error,
      };
    }

    return {
      status: "success",
      recipe: validation.data,
    };
  } catch (error) {
    console.error("Failed to structure imported recipe:", error);
    return {
      status: "validation-error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to structure imported recipe.",
    };
  }
}
