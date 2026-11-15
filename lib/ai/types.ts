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

export type ImportRecipeUrlOutput =
  | { status: "success"; recipe: StructuredRecipe }
  | { status: "not-a-recipe"; url: string; message: string }
  | { status: "fetch-error"; url: string; message: string }
  | { status: "validation-error"; url: string; message: string };

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchOutput =
  | { status: "success"; query: string; results: WebSearchSource[] }
  | { status: "no-results"; query: string; message: string }
  | { status: "unconfigured"; query: string; message: string }
  | { status: "error"; query: string; message: string };

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

export interface ImportUrlToolPart {
  type: "tool-importRecipeFromUrl";
  state: string;
  input?: { url?: string };
  output?: ImportRecipeUrlOutput;
}

export interface WebSearchToolPart {
  type: "tool-searchWeb";
  state: string;
  input?: { query?: string };
  output?: WebSearchOutput;
}

export interface TextPart {
  type: "text";
  text: string;
}

export interface FileAttachmentPart {
  type: "file";
  mediaType?: string;
  filename?: string;
  url: string;
}

export function isSearchToolPart(part: { type: string }): part is SearchToolPart {
  return part.type === "tool-searchDishByName";
}

export function isRecipeCardToolPart(part: { type: string }): part is RecipeCardToolPart {
  return part.type === "tool-showRecipeCard";
}

export function isImportUrlToolPart(part: { type: string }): part is ImportUrlToolPart {
  return part.type === "tool-importRecipeFromUrl";
}

export function isWebSearchToolPart(part: { type: string }): part is WebSearchToolPart {
  return part.type === "tool-searchWeb";
}

export function isTextPart(part: { type: string }): part is TextPart {
  return part.type === "text";
}

export function isFileAttachmentPart(part: { type: string }): part is FileAttachmentPart {
  return part.type === "file";
}

export function isSuccessfulRecipeCard(part: { type: string }): boolean {
  if (isRecipeCardToolPart(part)) {
    return part.state === "output-available" && part.output?.status === "success";
  }
  if (isImportUrlToolPart(part)) {
    return part.state === "output-available" && part.output?.status === "success";
  }
  return false;
}
