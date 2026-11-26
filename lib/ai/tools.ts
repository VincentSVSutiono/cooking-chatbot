import {
  tool,
  type InferUITools,
  type UIMessage,
  type UIDataTypes,
  type ToolUIPart,
} from "ai";
import z from "zod";
import { getRecipeByIdFromDb, searchRecipesInDb } from "@/lib/db/recipes";
import {
  assertSafeRecipeUrl,
  fetchSafeUrlHtml,
  extractUrlRecipe,
  isTransientFetchFailure,
  formatFetchErrorMessage,
} from "@/lib/recipes/url-import";
import {
  structureUrlRecipe,
  type GetRecipeOutput,
  type ImportUrlRecipeOutput,
} from "@/lib/recipes/structure";
import { extractWebPage, searchWebPage } from "@/lib/ai/tavily";

export function createCookingTools(modelId?: string) {
  const searchRecipes = tool({
    description:
      "Search our recipe database (TheMealDB and saved recipes) using semantic vector search. " +
      "Works for dish names (e.g., 'carbonara'), ingredients on hand (e.g., 'chicken, garlic, ginger, soy sauce'), " +
      "or meal vibes and descriptions (e.g., 'something warm and comforting with chicken'). " +
      "Returns candidate recipe matches so the user can preview options and choose one. " +
      "Do NOT call this tool for general cooking definitions or technique questions (e.g., 'what does simmer mean?').",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          "A dish name, comma-separated ingredients on hand, or meal description/vibe to search for, e.g. 'carbonara', 'chicken, garlic, ginger, soy sauce', or 'warm comforting chicken soup'",
        ),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Number of recipes to skip for pagination (3 results per page). Start at 0, then increment by 3 each time the user asks for more options (e.g., 3, then 6, then 9).",
        ),
    }),
    execute: ({ query, offset }) => searchRecipesInDb(query, offset),
  });

  const getRecipe = tool({
    description:
      "Look up a specific recipe by its database recipe id, load or structure its instructions into beginner-friendly steps, and display its full Recipe Card. " +
      "Call this tool ONLY when the user clicks 'View full recipe' or explicitly asks to open/view the full recipe card for a specific match.",
    inputSchema: z.object({
      id: z
        .string()
        .trim()
        .min(1)
        .describe(
          "The recipe ID from searchRecipes results, e.g. '52772' or 'web-a1b2c3d4e5f6'",
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
      const result = await getRecipeByIdFromDb(id, modelId);
      if (result.status !== "success" && !result.title && title) {
        return { ...result, title };
      }
      return result;
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
      "Search the web for live cooking information, seasonal produce, ingredient substitutions, or recipes not found in our recipe database. " +
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
