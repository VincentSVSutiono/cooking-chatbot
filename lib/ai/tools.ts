import {
  tool,
  type InferUITools,
  type UIMessage,
  type UIDataTypes,
  type ToolUIPart,
} from "ai";
import z from "zod";
import { getMealDbRecipeById, searchMealDbRecipes } from "@/lib/recipes/mealdb";
import {
  assertSafeRecipeUrl,
  fetchSafeUrlHtml,
  extractUrlRecipe,
  isTransientFetchFailure,
  formatFetchErrorMessage,
} from "@/lib/recipes/url-import";
import {
  structureMealDbRecipe,
  structureUrlRecipe,
  type GetRecipeOutput,
  type ImportUrlRecipeOutput,
} from "@/lib/recipes/structure";
import { extractWebPage, searchWebPage } from "@/lib/ai/tavily";

export function createCookingTools(modelId?: string) {
  const searchRecipes = tool({
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
    execute: ({ query, offset }) => searchMealDbRecipes(query, offset),
  });

  const getRecipe = tool({
    description:
      "Look up a specific meal by its TheMealDB recipe id, structure its instructions into beginner-friendly steps, and display its full Recipe Card. " +
      "Call this tool ONLY when the user clicks 'View full recipe' or explicitly asks to open/view the full recipe card for a specific match.",
    inputSchema: z.object({
      id: z
        .string()
        .trim()
        .min(1)
        .describe(
          "The TheMealDB recipe ID to look up, e.g. '52982' or '52772'",
        ),
      title: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
          "The title of the recipe being opened, e.g. 'Spaghetti Alla Carbonara'",
        ),
    }),
    execute: async ({ id, title }): Promise<GetRecipeOutput> => {
      const normalizedRecipe = await getMealDbRecipeById(id);
      if (!normalizedRecipe) {
        return {
          status: "not-found",
          id,
          title,
          message: `Could not find recipe #${id} in TheMealDB.`,
        };
      }

      return structureMealDbRecipe(normalizedRecipe, modelId);
    },
  });

  const importUrlRecipe = tool({
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
    execute: async ({ url }): Promise<ImportUrlRecipeOutput> => {
      try {
        const { html, finalUrl } = await fetchSafeUrlHtml(url);
        const extractedRecipe = extractUrlRecipe(html, finalUrl);
        return await structureUrlRecipe(extractedRecipe, modelId);
      } catch (error) {
        if (isTransientFetchFailure(error)) {
          try {
            const safeUrl = await assertSafeRecipeUrl(url);
            const extractedRecipeViaTavily = await extractWebPage(safeUrl.href);
            if (extractedRecipeViaTavily.status === "success") {
              const siteName =
                safeUrl.hostname.replace(/^www\./i, "") || "Web Recipe";
              return await structureUrlRecipe(
                {
                  mode: "page-text",
                  title: siteName,
                  textSnippet: extractedRecipeViaTavily.content,
                  youtubeUrl: null,
                  siteName,
                  sourceUrl: safeUrl.href,
                },
                modelId,
              );
            }
          } catch {
            // Fall through to the friendly fetch-error message below
          }
        }

        return {
          status: "fetch-error",
          url,
          message: formatFetchErrorMessage(error, url),
        };
      }
    },
  });

  const webSearch = tool({
    description:
      "Search the web for live cooking information, seasonal produce, ingredient substitutions, or recipes not found in TheMealDB. " +
      "Do NOT call this for dishes already found by searchRecipes or when the user already provided a recipe URL (use importUrlRecipe for URLs).",
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .describe(
          "A focused cooking search query, e.g. 'substitute for buttermilk in pancakes' or 'traditional beef rendang recipe'",
        ),
    }),
    execute: ({ query }) => searchWebPage(query),
  });

  return {
    searchRecipes,
    getRecipe,
    importUrlRecipe,
    webSearch,
  };
}

export type CookingTools = InferUITools<ReturnType<typeof createCookingTools>>;
export type ChatMessage = UIMessage<never, UIDataTypes, CookingTools>;
export type CookingToolPart = ToolUIPart<CookingTools>;
export type RecipeCardToolPart = Extract<
  CookingToolPart,
  { type: "tool-getRecipe" | "tool-importUrlRecipe" }
>;
