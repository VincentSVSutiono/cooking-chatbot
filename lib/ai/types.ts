import type { DishSearchResult } from "@/lib/recipes/search";
import type { StructuredRecipe } from "@/lib/recipes/schema";

export type ShowRecipeCardOutput =
  | { status: "success"; recipe: StructuredRecipe }
  | {
      status: "validation-error";
      mealId: string;
      mealName?: string;
      message: string;
    }
  | {
      status: "not-found";
      mealId: string;
      mealName?: string;
      message: string;
    };

export interface SearchToolPart {
  type: "tool-searchDishByName";
  state: string;
  output?: DishSearchResult;
}

export interface RecipeCardToolPart {
  type: "tool-showRecipeCard";
  state: string;
  output?: ShowRecipeCardOutput;
}

export interface TextPart {
  type: "text";
  text: string;
}

export function isSearchToolPart(part: { type: string }): part is SearchToolPart {
  return part.type === "tool-searchDishByName";
}

export function isRecipeCardToolPart(part: { type: string }): part is RecipeCardToolPart {
  return part.type === "tool-showRecipeCard";
}

export function isTextPart(part: { type: string }): part is TextPart {
  return part.type === "text";
}

export function isSuccessfulRecipeCard(part: { type: string }): boolean {
  if (!isRecipeCardToolPart(part)) return false;
  return part.state === "output-available" && part.output?.status === "success";
}
