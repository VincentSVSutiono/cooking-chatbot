import { tool } from "ai";
import z from "zod";
import { lookupRecipeById, searchRecipesByName } from "@/lib/recipes/search";
import { structureNormalizedRecipe } from "@/lib/recipes/structure";
import type { ShowRecipeCardOutput } from "./types";

export type { ShowRecipeCardOutput };

export function createCookingTools(modelId?: string) {
  const searchDishByName = tool({
    description:
      "Search TheMealDB for real, verified meal recipes by dish name or main ingredient keyword. " +
      "Returns candidate recipe matches so the user can preview options and choose one. " +
      "Use this whenever the user asks to cook or search for a dish (e.g., 'how to make carbonara', 'chicken curry recipe'). " +
      "Do NOT call this tool for general cooking definitions or technique questions (e.g., 'what does simmer mean?').",

    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          "The name of the dish or meal keyword to search for, e.g. 'carbonara', 'beef stew', or 'pancakes'",
        ),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Number of recipes to skip for pagination (e.g. 3 to see the next batch of recipes)",
        ),
    }),

    execute: ({ query, offset }) => searchRecipesByName(query, offset),
  });

  const showRecipeCard = tool({
    description:
      "Look up a specific meal by its TheMealDB mealId, structure its instructions into beginner-friendly steps, and display its full Recipe Card. " +
      "Call this tool ONLY when the user clicks 'View full recipe' or explicitly asks to open/view the full recipe card for a specific match.",
    inputSchema: z.object({
      mealId: z
        .string()
        .trim()
        .min(1)
        .describe("The TheMealDB meal ID to look up, e.g. '52982' or '52772'"),
      mealName: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "The name of the meal being opened, e.g. 'Spaghetti Alla Carbonara'",
        ),
    }),
    execute: async ({ mealId, mealName }): Promise<ShowRecipeCardOutput> => {
      const rawRecipe = await lookupRecipeById(mealId);
      if (!rawRecipe) {
        return {
          status: "not-found",
          mealId,
          mealName,
          message: `Could not find recipe #${mealId} in TheMealDB.`,
        };
      }

      const validation = await structureNormalizedRecipe(rawRecipe, modelId);
      if (!validation.success) {
        return {
          status: "validation-error",
          mealId,
          mealName: rawRecipe.name,
          message: validation.error,
        };
      }

      return {
        status: "success",
        recipe: validation.data,
      };
    },
  });

  return {
    searchDishByName,
    showRecipeCard,
  };
}
