import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

export const RecipeIngredientSchema = z.object({
  item: NonEmptyString,
  amount: z.string().trim(),
});

export const RecipeTimesSchema = z.object({
  prep: NonEmptyString.nullable(),
  cook: NonEmptyString.nullable(),
  total: NonEmptyString.nullable(),
});

export const RecipeSourceSchema = z.object({
  name: NonEmptyString,
  url: z.url(),
  creditText: NonEmptyString,
  thumbnailUrl: z.url().nullable(),
  youtubeUrl: z.url().nullable(),
  category: z.string().trim().nullable(),
  area: z.string().trim().nullable(),
});

export const RecipeSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  ingredients: z.array(RecipeIngredientSchema).min(1),
  steps: z.array(NonEmptyString).min(1),
  times: RecipeTimesSchema,
  safetyNote: NonEmptyString.nullable(),
  source: RecipeSourceSchema,
});

export type StructuredRecipe = z.infer<typeof RecipeSchema>;

export type RecipeValidationResult =
  { success: true; data: StructuredRecipe } | { success: false; error: string };

export function validateRecipe(data: unknown): RecipeValidationResult {
  const result = RecipeSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: z.prettifyError(result.error),
    };
  }
  return {
    success: true,
    data: result.data,
  };
}
