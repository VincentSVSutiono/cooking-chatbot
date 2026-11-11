import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatModel } from "@/config/ai";
import type { NormalizedRecipe } from "./search";
import { validateRecipe, type RecipeValidationResult } from "./schema";

export const THEMEALDB_CREDIT_TEXT =
  "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)";

const NonEmptyString = z.string().trim().min(1);

export const InstructionBreakdownSchema = z.object({
  steps: z
    .array(NonEmptyString)
    .min(1)
    .describe(
      "Break the raw recipe instructions into clear, ordered, beginner-friendly steps. " +
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
