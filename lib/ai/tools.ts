import { tool } from "ai";
import z from "zod";
import { lookupRecipeById, searchRecipesByName } from "@/lib/recipes/search";
import {
  fetchSafeRecipeHtml,
  extractRecipeFromHtml,
} from "@/lib/recipes/url-import";
import {
  structureNormalizedRecipe,
  structureImportedRecipe,
} from "@/lib/recipes/structure";
import { searchCookingWeb } from "@/lib/ai/web-search";
import type { ShowRecipeCardOutput, ImportRecipeUrlOutput } from "./types";

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

  const importRecipeFromUrl = tool({
    description:
      "Fetch a user-provided recipe webpage URL, extract its recipe content, structure it into beginner-friendly steps, and display a full Recipe Card. " +
      "Call this tool whenever the user pastes or asks to import a recipe from an http:// or https:// URL.",
    inputSchema: z.object({
      url: z
        .string()
        .trim()
        .min(1)
        .describe("The http:// or https:// recipe URL provided by the user"),
    }),
    execute: async ({ url }): Promise<ImportRecipeUrlOutput> => {
      try {
        const { html, finalUrl } = await fetchSafeRecipeHtml(url);
        const candidate = extractRecipeFromHtml(html, finalUrl);

        const validation = await structureImportedRecipe(candidate, modelId);
        if (validation.status === "success") {
          return {
            status: "success",
            recipe: validation.recipe,
          };
        }

        return {
          status: validation.status,
          url: candidate.pageUrl,
          message: validation.message,
        };
      } catch (error) {
        return {
          status: "fetch-error",
          url,
          message:
            error instanceof Error
              ? error.message
              : "Could not fetch that URL.",
        };
      }
    },
  });

  const searchWeb = tool({
    description:
      "Search the web for live cooking information, seasonal produce, ingredient substitutions, or recipes not found in TheMealDB. " +
      "Do NOT call this for dishes already found by searchDishByName or when the user already provided a recipe URL (use importRecipeFromUrl for URLs).",
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .describe(
          "A focused cooking search query, e.g. 'substitute for buttermilk in pancakes' or 'traditional beef rendang recipe'",
        ),
    }),
    execute: ({ query }) => searchCookingWeb(query),
  });

  return {
    searchDishByName,
    showRecipeCard,
    importRecipeFromUrl,
    searchWeb,
  };
}
