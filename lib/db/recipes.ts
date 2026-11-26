import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedRecipeDocument, embedSearchQuery } from "@/lib/ai/embeddings";
import {
  THEMEALDB_CREDIT_TEXT,
  translateSynonyms,
  type NormalizedMealDbRecipe,
  type SearchRecipesOutput,
} from "@/lib/recipes/mealdb";
import {
  validateRecipe,
  type RecipeIngredient,
  type StructuredRecipe,
} from "@/lib/recipes/schema";
import {
  structureMealDbRecipe,
  type GetRecipeOutput,
} from "@/lib/recipes/structure";
import { getSupabaseAdminClient } from "./client";

const DEFAULT_MATCH_THRESHOLD = 0.35;
const DEFAULT_PAGE_LIMIT = 3;

const RECIPE_PREVIEW_COLUMNS =
  "id, source_type, title, category, area, ingredients, instructions, thumbnail_url, source_url, source_name, credit_text, youtube_url";

interface RecipeRow {
  id: string;
  source_type: "mealdb" | "web";
  title: string;
  category: string | null;
  area: string | null;
  ingredients: unknown;
  instructions: string;
  thumbnail_url: string | null;
  source_url: string;
  source_name: string;
  credit_text: string;
  youtube_url: string | null;
  structured_recipe?: unknown;
  similarity?: number | null;
  total_matches?: number | string | null;
}

export interface RecipeRepositoryDeps {
  supabase?: SupabaseClient;
  embedQueryFn?: typeof embedSearchQuery;
  embedDocumentFn?: typeof embedRecipeDocument;
  structureFn?: typeof structureMealDbRecipe;
}

function normalizeIngredients(raw: unknown): RecipeIngredient[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const ingredients: RecipeIngredient[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item =
      "item" in entry && typeof entry.item === "string"
        ? entry.item.trim()
        : "";
    const amount =
      "amount" in entry && typeof entry.amount === "string"
        ? entry.amount.trim()
        : "";
    if (item) {
      ingredients.push({ item, amount });
    }
  }
  return ingredients;
}

function mapRecipeRowToNormalized(row: RecipeRow): NormalizedMealDbRecipe {
  const mapped: NormalizedMealDbRecipe = {
    id: String(row.id),
    title: String(row.title),
    category: row.category ?? null,
    area: row.area ?? null,
    instructions: String(row.instructions ?? ""),
    ingredients: normalizeIngredients(row.ingredients),
    thumbnailUrl: row.thumbnail_url ?? null,
    sourceUrl: String(row.source_url),
    youtubeUrl: row.youtube_url ?? null,
    sourceName: row.source_name || "TheMealDB",
    creditText: row.credit_text || THEMEALDB_CREDIT_TEXT,
  };

  if (typeof row.similarity === "number" && Number.isFinite(row.similarity)) {
    mapped.similarity = row.similarity;
  }

  return mapped;
}

function canonicalizeRecipeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Generates a deterministic ID (`web-<12-char-sha256>`) from a recipe's canonical URL
 * so re-saving the same web recipe updates the existing row instead of duplicating it.
 */
export function buildWebRecipeId(sourceUrl: string): string {
  const canonical = canonicalizeRecipeUrl(sourceUrl);
  const hash = createHash("sha256")
    .update(canonical)
    .digest("hex")
    .slice(0, 12);
  return `web-${hash}`;
}

/**
 * Semantic vector search against `public.recipes` via the `match_recipes` pgvector RPC.
 */
export async function searchRecipesInDb(
  query: string,
  offset = 0,
  limit = DEFAULT_PAGE_LIMIT,
  deps?: RecipeRepositoryDeps,
): Promise<SearchRecipesOutput> {
  const cleanQuery = query.trim();
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(1, Math.floor(limit));

  if (!cleanQuery) {
    return {
      query,
      found: false,
      totalMatches: 0,
      offset: safeOffset,
      recipes: [],
    };
  }

  try {
    const embedQueryFn = deps?.embedQueryFn ?? embedSearchQuery;
    const supabase = deps?.supabase ?? getSupabaseAdminClient();

    const queryEmbedding = await embedQueryFn(cleanQuery);
    const { data, error } = await supabase.rpc("match_recipes", {
      query_embedding: queryEmbedding,
      query_text: cleanQuery,
      match_threshold: DEFAULT_MATCH_THRESHOLD,
      match_count: safeLimit,
      match_offset: safeOffset,
    });

    if (error) {
      console.error("Failed to run match_recipes RPC:", error.message);
      return {
        query,
        found: false,
        totalMatches: 0,
        offset: safeOffset,
        recipes: [],
      };
    }

    const rows = Array.isArray(data) ? (data as RecipeRow[]) : [];
    const totalMatches =
      rows.length > 0 ? Number(rows[0].total_matches ?? rows.length) : 0;

    return {
      query,
      found: totalMatches > 0 && rows.length > 0,
      totalMatches,
      offset: safeOffset,
      recipes: rows.map(mapRecipeRowToNormalized),
    };
  } catch (error) {
    console.error("Failed to search recipes in DB:", error);
    return {
      query,
      found: false,
      totalMatches: 0,
      offset: safeOffset,
      recipes: [],
    };
  }
}

/**
 * Loads a recipe by ID from `public.recipes` and returns a validated `StructuredRecipe`.
 * Uses `structured_recipe` as a lazy, self-healing cache: valid cached JSON returns
 * immediately with 0 LLM calls; missing or invalid cached JSON re-structures and updates the row.
 */
export async function getRecipeByIdFromDb(
  id: string,
  modelId?: string,
  deps?: RecipeRepositoryDeps,
): Promise<GetRecipeOutput> {
  const trimmedId = id.trim();
  if (!trimmedId) {
    return {
      status: "not-found",
      id,
      message: "Recipe ID cannot be empty.",
    };
  }

  const supabase = deps?.supabase ?? getSupabaseAdminClient();
  const structureFn = deps?.structureFn ?? structureMealDbRecipe;

  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_PREVIEW_COLUMNS}, structured_recipe`)
    .eq("id", trimmedId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to load recipe ${trimmedId} from DB:`, error.message);
    return {
      status: "fetch-error",
      id: trimmedId,
      message: `Could not load recipe #${trimmedId} from the recipe database.`,
    };
  }

  if (!data) {
    return {
      status: "not-found",
      id: trimmedId,
      message: `Could not find recipe #${trimmedId} in the recipe database.`,
    };
  }

  const row = data as RecipeRow;

  if (row.structured_recipe !== null && row.structured_recipe !== undefined) {
    const cachedValidation = validateRecipe(row.structured_recipe);
    if (cachedValidation.success) {
      return {
        status: "success",
        recipe: cachedValidation.data,
      };
    }

    console.warn(
      `Cached structured_recipe for ${trimmedId} failed validation; regenerating.`,
    );
  }

  const normalizedRecipe = mapRecipeRowToNormalized(row);
  const structuredRecipe = await structureFn(normalizedRecipe, modelId);

  if (structuredRecipe.status === "success") {
    const { error: cacheError } = await supabase
      .from("recipes")
      .update({
        structured_recipe: structuredRecipe.recipe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trimmedId);

    if (cacheError) {
      console.warn(
        `Failed to cache structured_recipe for ${trimmedId}:`,
        cacheError.message,
      );
    }
  }

  return structuredRecipe;
}

/**
 * Embeds and upserts a validated web-imported recipe into `public.recipes`
 * with `source_type = 'web'` and pre-populated `structured_recipe`.
 */
export async function saveWebRecipeToDb(
  recipe: StructuredRecipe,
  deps?: RecipeRepositoryDeps,
): Promise<{ id: string }> {
  const supabase = deps?.supabase ?? getSupabaseAdminClient();
  const embedDocumentFn = deps?.embedDocumentFn ?? embedRecipeDocument;

  const id = buildWebRecipeId(recipe.source.url);
  const instructions = recipe.steps.join("\n\n");
  const embedding = await embedDocumentFn({
    title: recipe.title,
    category: recipe.source.category,
    area: recipe.source.area,
    ingredients: recipe.ingredients,
    instructions,
  });

  const structuredToStore: StructuredRecipe = {
    ...recipe,
    id,
  };

  const { error } = await supabase.from("recipes").upsert(
    {
      id,
      source_type: "web",
      title: recipe.title,
      category: recipe.source.category,
      area: recipe.source.area,
      ingredients: recipe.ingredients,
      instructions,
      thumbnail_url: recipe.source.thumbnailUrl,
      source_url: recipe.source.url,
      source_name: recipe.source.name,
      credit_text: recipe.source.creditText,
      youtube_url: recipe.source.youtubeUrl,
      structured_recipe: structuredToStore,
      embedding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Failed to save web recipe ${id}: ${error.message}`);
  }

  return { id };
}

// ============================================================================
// CLI Seeding & Search Benchmark Helpers (not called by the live chat app)
// ============================================================================

export interface SeedMealDbRecipeEntry {
  recipe: NormalizedMealDbRecipe;
  embedding: number[];
}

function escapeSqlLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * SQL title keyword search (`ILIKE` with US-to-UK culinary synonym fallback)
 * used by `scripts/compare-search.ts` to benchmark keyword vs. vector search.
 */
export async function searchRecipesByKeywordInDb(
  query: string,
  offset = 0,
  limit = DEFAULT_PAGE_LIMIT,
  deps?: RecipeRepositoryDeps,
): Promise<SearchRecipesOutput> {
  const cleanQuery = query.trim().toLowerCase();
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(1, Math.floor(limit));

  if (!cleanQuery) {
    return {
      query,
      found: false,
      totalMatches: 0,
      offset: safeOffset,
      recipes: [],
    };
  }

  const supabase = deps?.supabase ?? getSupabaseAdminClient();

  async function runTitleIlike(term: string) {
    const escaped = escapeSqlLikePattern(term);
    return supabase
      .from("recipes")
      .select(RECIPE_PREVIEW_COLUMNS, { count: "exact" })
      .ilike("title", `%${escaped}%`)
      .order("title", { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);
  }

  const primaryResult = await runTitleIlike(cleanQuery);
  let data = primaryResult.data;
  let count = primaryResult.count;
  const error = primaryResult.error;
  let translatedQuery: string | undefined;

  if (!error && (!data || data.length === 0)) {
    const translated = translateSynonyms(cleanQuery);
    if (translated) {
      const synonymResult = await runTitleIlike(translated);
      if (!synonymResult.error && synonymResult.data?.length) {
        data = synonymResult.data;
        count = synonymResult.count;
        translatedQuery = translated;
      }
    }
  }

  if (error) {
    console.error("Failed keyword recipe search in DB:", error.message);
    return {
      query,
      found: false,
      totalMatches: 0,
      offset: safeOffset,
      recipes: [],
    };
  }

  const rows = Array.isArray(data) ? (data as RecipeRow[]) : [];
  const totalMatches = count ?? rows.length;

  return {
    query,
    translatedQuery,
    found: totalMatches > 0 && rows.length > 0,
    totalMatches,
    offset: safeOffset,
    recipes: rows.map(mapRecipeRowToNormalized),
  };
}

/**
 * Upserts a batch of embedded TheMealDB recipes without overwriting `structured_recipe`
 * or touching any `source_type = 'web'` rows. Used by `scripts/seed-mealdb.ts`.
 */
export async function upsertMealDbRecipesBatch(
  entries: SeedMealDbRecipeEntry[],
  deps?: RecipeRepositoryDeps,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const supabase = deps?.supabase ?? getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const rows = entries.map(({ recipe, embedding }) => ({
    id: recipe.id,
    source_type: "mealdb" as const,
    title: recipe.title,
    category: recipe.category,
    area: recipe.area,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    thumbnail_url: recipe.thumbnailUrl,
    source_url: recipe.sourceUrl,
    source_name: recipe.sourceName ?? "TheMealDB",
    credit_text: recipe.creditText ?? THEMEALDB_CREDIT_TEXT,
    youtube_url: recipe.youtubeUrl,
    embedding,
    updated_at: nowIso,
  }));

  const { error } = await supabase
    .from("recipes")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to upsert MealDB recipes batch: ${error.message}`);
  }
}

/**
 * Returns the set of TheMealDB recipe IDs already stored in `public.recipes`
 * so `scripts/seed-mealdb.ts` can resume without re-embedding existing recipes.
 */
export async function listSeededMealDbIds(
  deps?: RecipeRepositoryDeps,
): Promise<Set<string>> {
  const supabase = deps?.supabase ?? getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id")
    .eq("source_type", "mealdb");

  if (error) {
    throw new Error(`Failed to list seeded MealDB IDs: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => String(row.id)));
}

/**
 * Counts stored recipes grouped by source type (`mealdb` vs `web`).
 * Used by `scripts/seed-mealdb.ts` to confirm saved web recipes stay untouched.
 */
export async function countRecipesBySourceType(
  deps?: RecipeRepositoryDeps,
): Promise<{ mealdb: number; web: number }> {
  const supabase = deps?.supabase ?? getSupabaseAdminClient();

  const [mealdbRes, webRes] = await Promise.all([
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "mealdb"),
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "web"),
  ]);

  if (mealdbRes.error) {
    throw new Error(
      `Failed to count MealDB recipes: ${mealdbRes.error.message}`,
    );
  }
  if (webRes.error) {
    throw new Error(`Failed to count web recipes: ${webRes.error.message}`);
  }

  return {
    mealdb: mealdbRes.count ?? 0,
    web: webRes.count ?? 0,
  };
}
