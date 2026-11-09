import { tool } from "ai";
import z from "zod";
import { searchRecipesByName } from "@/lib/recipes/search";

export const searchDishByName = tool({
  description:
    "Search TheMealDB for real, verified meal recipes by dish name or main ingredient keyword. " +
    "Returns normalized recipes with exact ingredient amounts, preparation instructions, and source URLs. " +
    "Use this whenever the user asks to cook or prepare a specific dish (e.g., 'how to make carbonara', 'chicken curry recipe'). " +
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

export const cookingTools = {
  searchDishByName,
};
