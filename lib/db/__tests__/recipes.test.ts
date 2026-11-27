import { afterEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { saveWebRecipeToDbMock } = vi.hoisted(() => ({
  saveWebRecipeToDbMock: {
    impl: null as ((recipe: StructuredRecipe) => Promise<{ id: string }>) | null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/db/recipes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/recipes")>();
  return {
    ...actual,
    saveWebRecipeToDb: (
      ...args: Parameters<typeof actual.saveWebRecipeToDb>
    ) =>
      saveWebRecipeToDbMock.impl
        ? saveWebRecipeToDbMock.impl(args[0])
        : actual.saveWebRecipeToDb(...args),
  };
});

import { saveWebRecipeAction } from "@/lib/db/actions";
import {
  buildWebRecipeId,
  getRecipeByIdFromDb,
  saveWebRecipeToDb,
  searchRecipesInDb,
} from "@/lib/db/recipes";
import { THEMEALDB_CREDIT_TEXT } from "@/lib/recipes/mealdb";
import type { StructuredRecipe } from "@/lib/recipes/schema";

const SAMPLE_VECTOR = Array.from({ length: 768 }, () => 1 / Math.sqrt(768));

const SAMPLE_STRUCTURED_RECIPE: StructuredRecipe = {
  id: "52772",
  title: "Teriyaki Chicken Casserole",
  ingredients: [{ item: "chicken thighs", amount: "500g" }],
  steps: ["Sear chicken in a skillet over medium heat until browned."],
  times: { prep: "10 minutes", cook: "20 minutes", total: "30 minutes" },
  safetyNote: null,
  source: {
    name: "TheMealDB",
    url: "https://www.themealdb.com/meal/52772",
    creditText: THEMEALDB_CREDIT_TEXT,
    thumbnailUrl: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    youtubeUrl: null,
    category: "Chicken",
    area: "Japanese",
  },
};

const SAMPLE_DB_ROW = {
  id: "52772",
  source_type: "mealdb",
  title: "Teriyaki Chicken Casserole",
  category: "Chicken",
  area: "Japanese",
  ingredients: [{ item: "chicken thighs", amount: "500g" }],
  instructions: "Sear chicken in a skillet.",
  thumbnail_url: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
  source_url: "https://www.themealdb.com/meal/52772",
  source_name: "TheMealDB",
  credit_text: THEMEALDB_CREDIT_TEXT,
  youtube_url: null,
  structured_recipe: null as unknown,
};

function makeFakeSupabase({
  rpcResult = { data: [], error: null },
  selectResult = { data: null, error: null },
  updateError = null,
  upsertError = null,
}: {
  rpcResult?: { data: unknown; error: { message: string } | null };
  selectResult?: { data: unknown; error: { message: string } | null };
  updateError?: { message: string } | null;
  upsertError?: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const maybeSingle = vi.fn().mockResolvedValue(selectResult);
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });

  const from = vi.fn().mockReturnValue({
    select,
    update,
    upsert,
  });

  return {
    client: { rpc, from } as unknown as SupabaseClient,
    spies: { rpc, from, select, update, updateEq, upsert },
  };
}

describe("buildWebRecipeId", () => {
  it("produces identical deterministic web- IDs for equivalent URL variations", () => {
    const idA = buildWebRecipeId(
      "https://www.recipetineats.com/pasta-carbonara/",
    );
    const idB = buildWebRecipeId(
      "HTTPS://WWW.RECIPETINEATS.COM/pasta-carbonara#recipe",
    );
    const idQueryA = buildWebRecipeId(
      "https://www.recipetineats.com/pasta-carbonara/?utm=1&ref=chat",
    );
    const idQueryB = buildWebRecipeId(
      "https://www.recipetineats.com/pasta-carbonara?ref=chat&utm=1",
    );
    const otherId = buildWebRecipeId(
      "https://www.recipetineats.com/chicken-curry",
    );

    expect(idA).toMatch(/^web-[0-9a-f]{12}$/);
    expect(idA).toBe(idB);
    expect(idQueryA).toBe(idQueryB);
    expect(idA).not.toBe(otherId);
  });
});

describe("searchRecipesInDb", () => {
  it("returns empty without calling embeddings or RPC on blank query", async () => {
    const embedQueryFn = vi.fn();
    const { client, spies } = makeFakeSupabase({});

    const result = await searchRecipesInDb("   ", 0, 3, {
      supabase: client,
      embedQueryFn,
    });

    expect(result).toEqual({
      query: "   ",
      found: false,
      totalMatches: 0,
      offset: 0,
      recipes: [],
    });
    expect(embedQueryFn).not.toHaveBeenCalled();
    expect(spies.rpc).not.toHaveBeenCalled();
  });

  it("embeds query, calls match_recipes RPC, and preserves sourceName and similarity", async () => {
    const embedQueryFn = vi.fn().mockResolvedValue(SAMPLE_VECTOR);
    const { client, spies } = makeFakeSupabase({
      rpcResult: {
        data: [
          {
            ...SAMPLE_DB_ROW,
            id: "web-abc123def456",
            source_type: "web",
            title: "Creamy Garlic Pasta",
            source_name: "recipetineats.com",
            credit_text: "Recipe imported from recipetineats.com",
            similarity: 0.84,
            total_matches: 7,
          },
        ],
        error: null,
      },
    });

    const result = await searchRecipesInDb("  creamy garlic pasta ", 3, 3, {
      supabase: client,
      embedQueryFn,
    });

    expect(embedQueryFn).toHaveBeenCalledWith("creamy garlic pasta");
    expect(spies.rpc).toHaveBeenCalledWith("match_recipes", {
      query_embedding: SAMPLE_VECTOR,
      query_text: "creamy garlic pasta",
      match_threshold: 0.5,
      match_count: 3,
      match_offset: 3,
    });
    expect(result.found).toBe(true);
    expect(result.totalMatches).toBe(7);
    expect(result.offset).toBe(3);
    expect(result.recipes[0]).toMatchObject({
      id: "web-abc123def456",
      title: "Creamy Garlic Pasta",
      sourceName: "recipetineats.com",
      creditText: "Recipe imported from recipetineats.com",
      similarity: 0.84,
    });
  });

  it("returns found: false gracefully when RPC or embedding errors occur", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const embedQueryFn = vi.fn().mockRejectedValue(new Error("429 quota"));
    const { client } = makeFakeSupabase({});

    const result = await searchRecipesInDb("chicken curry", 0, 3, {
      supabase: client,
      embedQueryFn,
    });

    expect(result.found).toBe(false);
    expect(result.recipes).toEqual([]);
    errorSpy.mockRestore();
  });
});

describe("getRecipeByIdFromDb", () => {
  it("returns not-found when the recipe row does not exist", async () => {
    const { client } = makeFakeSupabase({
      selectResult: { data: null, error: null },
    });

    const result = await getRecipeByIdFromDb("99999", undefined, {
      supabase: client,
    });

    expect(result).toEqual({
      status: "not-found",
      id: "99999",
      message: "Could not find recipe #99999 in the recipe database.",
    });
  });

  it("returns fetch-error when Supabase select fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeFakeSupabase({
      selectResult: { data: null, error: { message: "connection refused" } },
    });

    const result = await getRecipeByIdFromDb("52772", undefined, {
      supabase: client,
    });

    expect(result.status).toBe("fetch-error");
    errorSpy.mockRestore();
  });

  it("returns valid cached structured_recipe immediately without calling LLM or updating DB", async () => {
    const structureFn = vi.fn();
    const { client, spies } = makeFakeSupabase({
      selectResult: {
        data: { ...SAMPLE_DB_ROW, structured_recipe: SAMPLE_STRUCTURED_RECIPE },
        error: null,
      },
    });

    const result = await getRecipeByIdFromDb("52772", undefined, {
      supabase: client,
      structureFn,
    });

    expect(result).toEqual({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    expect(structureFn).not.toHaveBeenCalled();
    expect(spies.update).not.toHaveBeenCalled();
  });

  it("structures and caches a recipe on cache miss (structured_recipe is null)", async () => {
    const structureFn = vi
      .fn()
      .mockResolvedValue({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    const { client, spies } = makeFakeSupabase({
      selectResult: {
        data: { ...SAMPLE_DB_ROW, structured_recipe: null },
        error: null,
      },
    });

    const result = await getRecipeByIdFromDb("52772", "gemini-3.5-flash-lite", {
      supabase: client,
      structureFn,
    });

    expect(result).toEqual({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    expect(structureFn).toHaveBeenCalledTimes(1);
    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({
        structured_recipe: SAMPLE_STRUCTURED_RECIPE,
      }),
    );
    expect(spies.updateEq).toHaveBeenCalledWith("id", "52772");
  });

  it("self-heals when cached structured_recipe fails schema validation", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const structureFn = vi
      .fn()
      .mockResolvedValue({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    const { client, spies } = makeFakeSupabase({
      selectResult: {
        data: {
          ...SAMPLE_DB_ROW,
          structured_recipe: { id: "52772", title: "Incomplete" },
        },
        error: null,
      },
    });

    const result = await getRecipeByIdFromDb("52772", undefined, {
      supabase: client,
      structureFn,
    });

    expect(result).toEqual({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    expect(structureFn).toHaveBeenCalledTimes(1);
    expect(spies.update).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("still returns structured recipe when best-effort cache update fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const structureFn = vi
      .fn()
      .mockResolvedValue({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    const { client } = makeFakeSupabase({
      selectResult: {
        data: { ...SAMPLE_DB_ROW, structured_recipe: null },
        error: null,
      },
      updateError: { message: "read-only replica" },
    });

    const result = await getRecipeByIdFromDb("52772", undefined, {
      supabase: client,
      structureFn,
    });

    expect(result).toEqual({ status: "success", recipe: SAMPLE_STRUCTURED_RECIPE });
    warnSpy.mockRestore();
  });
});

describe("saveWebRecipeToDb", () => {
  it("embeds a validated web recipe and upserts it with a deterministic web- ID", async () => {
    const embedDocumentFn = vi.fn().mockResolvedValue(SAMPLE_VECTOR);
    const { client, spies } = makeFakeSupabase({});

    const webRecipe: StructuredRecipe = {
      ...SAMPLE_STRUCTURED_RECIPE,
      id: "url-https%3A%2F%2Fwww.recipetineats.com%2Fpasta-carbonara",
      source: {
        ...SAMPLE_STRUCTURED_RECIPE.source,
        name: "recipetineats.com",
        url: "https://www.recipetineats.com/pasta-carbonara/",
        creditText:
          "Recipe imported from recipetineats.com (https://www.recipetineats.com/pasta-carbonara/)",
      },
    };

    const { id } = await saveWebRecipeToDb(webRecipe, {
      supabase: client,
      embedDocumentFn,
    });

    expect(id).toBe(
      buildWebRecipeId("https://www.recipetineats.com/pasta-carbonara/"),
    );
    expect(embedDocumentFn).toHaveBeenCalledWith({
      title: webRecipe.title,
      category: webRecipe.source.category,
      area: webRecipe.source.area,
      ingredients: webRecipe.ingredients,
      instructions: webRecipe.steps.join("\n\n"),
    });
    expect(spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        source_type: "web",
        source_name: "recipetineats.com",
        embedding: SAMPLE_VECTOR,
        structured_recipe: expect.objectContaining({ id }),
      }),
      { onConflict: "id" },
    );
  });
});

describe("saveWebRecipeAction", () => {
  afterEach(() => {
    saveWebRecipeToDbMock.impl = null;
  });

  it("rejects invalid recipe input at the boundary without calling saveWebRecipeToDb", async () => {
    const mockSave = vi.fn();
    saveWebRecipeToDbMock.impl = mockSave;

    const nullResult = await saveWebRecipeAction(null);
    const badResult = await saveWebRecipeAction({ title: "Incomplete" });

    expect(nullResult).toEqual({
      status: "error",
      message: "Invalid recipe data. Could not save recipe.",
    });
    expect(badResult).toEqual({
      status: "error",
      message: "Invalid recipe data. Could not save recipe.",
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("validates a web recipe and returns its saved deterministic ID", async () => {
    const mockSave = vi.fn().mockResolvedValue({ id: "web-abc123def456" });
    saveWebRecipeToDbMock.impl = mockSave;

    const webRecipe: StructuredRecipe = {
      ...SAMPLE_STRUCTURED_RECIPE,
      id: "url-https%3A%2F%2Fwww.recipetineats.com%2Fpasta-carbonara",
      source: {
        ...SAMPLE_STRUCTURED_RECIPE.source,
        name: "recipetineats.com",
        url: "https://www.recipetineats.com/pasta-carbonara/",
        creditText:
          "Recipe imported from recipetineats.com (https://www.recipetineats.com/pasta-carbonara/)",
      },
    };

    const result = await saveWebRecipeAction(webRecipe);

    expect(result).toEqual({ status: "success", id: "web-abc123def456" });
    expect(mockSave).toHaveBeenCalledWith(webRecipe);
  });

  it("returns a friendly error when embedding or database persistence fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    saveWebRecipeToDbMock.impl = vi
      .fn()
      .mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));

    const result = await saveWebRecipeAction(SAMPLE_STRUCTURED_RECIPE);

    expect(result).toEqual({
      status: "error",
      message: "Could not save recipe. Please try again.",
    });
    errorSpy.mockRestore();
  });
});
