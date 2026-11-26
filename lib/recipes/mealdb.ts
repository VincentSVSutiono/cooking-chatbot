import type { RecipeIngredient } from "./schema";

export const THEMEALDB_URL = "https://www.themealdb.com/";
export const THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1";
export const THEMEALDB_CREDIT_TEXT =
  "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)";

export interface NormalizedMealDbRecipe {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  instructions: string;
  ingredients: RecipeIngredient[];
  thumbnailUrl: string | null;
  sourceUrl: string;
  youtubeUrl: string | null;
  sourceName?: string;
  creditText?: string;
  similarity?: number;
}

export interface SearchRecipesOutput {
  query: string;
  translatedQuery?: string;
  found: boolean;
  totalMatches: number;
  offset: number;
  recipes: NormalizedMealDbRecipe[];
}

type RawMealDbRecord = Record<string, unknown>;

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeMealDbRecord(
  raw: RawMealDbRecord,
): NormalizedMealDbRecipe {
  const id = toNonEmptyString(raw.idMeal) ?? "";
  const ingredients: RecipeIngredient[] = [];

  for (let i = 1; i <= 20; i++) {
    const item = toNonEmptyString(raw[`strIngredient${i}`]);
    const amount = toNonEmptyString(raw[`strMeasure${i}`]) ?? "";
    if (item) ingredients.push({ item, amount });
  }

  return {
    id,
    title: toNonEmptyString(raw.strMeal) ?? "Untitled Recipe",
    category: toNonEmptyString(raw.strCategory),
    area: toNonEmptyString(raw.strArea),
    instructions: toNonEmptyString(raw.strInstructions) ?? "",
    ingredients,
    thumbnailUrl: toNonEmptyString(raw.strMealThumb),
    sourceUrl: `https://www.themealdb.com/meal/${id}`,
    youtubeUrl: toNonEmptyString(raw.strYoutube),
  };
}

async function fetchMealDbRecords(
  endpoint: string,
): Promise<RawMealDbRecord[]> {
  try {
    const res = await fetch(`${THEMEALDB_BASE_URL}/${endpoint}`);
    if (!res.ok) return [];

    const data = (await res.json()) as { meals?: unknown };
    return Array.isArray(data.meals) ? (data.meals as RawMealDbRecord[]) : [];
  } catch (error) {
    console.error(`TheMealDB fetch error (${endpoint}):`, error);
    return [];
  }
}

async function fetchMealDbByTerm(term: string): Promise<RawMealDbRecord[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  return fetchMealDbRecords(`search.php?s=${encodeURIComponent(trimmed)}`);
}

// Only US to UK and not the other way is because TheMealDB data uses British culinary terms
const US_TO_UK_SYNONYMS: Record<string, string> = {
  eggplant: "aubergine",
  zucchini: "courgette",
  cilantro: "coriander",
  shrimp: "prawn",
  arugula: "rocket",
};

export function translateSynonyms(query: string): string | null {
  let translated = query;
  for (const [usWord, ukWord] of Object.entries(US_TO_UK_SYNONYMS)) {
    const regex = new RegExp(`\\b${usWord}\\b`, "gi");
    translated = translated.replace(regex, ukWord);
  }
  return translated !== query ? translated : null;
}

async function searchMultiWordMatches(
  query: string,
): Promise<RawMealDbRecord[]> {
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length <= 1) return [];

  const termResults = await Promise.all(
    terms.map((term) => fetchMealDbByTerm(term)),
  );
  const mealMap = new Map<string, RawMealDbRecord>();

  for (const result of termResults) {
    for (const meal of result) {
      const id = String(meal.idMeal ?? "");
      if (id && !mealMap.has(id)) {
        mealMap.set(id, meal);
      }
    }
  }

  // Enforce meaningful overlap to prevent single incidental keyword false-positives:
  // For a 2-word query ("spaghetti carbonara"), both words must appear in the title.
  // For 3+ words, at least 2 words or >= 50% of the query terms must appear in the title.
  const minRequiredMatches =
    terms.length === 2 ? 2 : Math.max(2, Math.ceil(terms.length * 0.5));

  const scoredMeals = Array.from(mealMap.values())
    .map((meal) => {
      const title = String(meal.strMeal ?? "").toLowerCase();
      const matchCount = terms.filter((t) => title.includes(t)).length;
      return { meal, matchCount };
    })
    .filter((item) => item.matchCount >= minRequiredMatches)
    .sort((a, b) => b.matchCount - a.matchCount);

  return scoredMeals.map((item) => item.meal);
}

export async function searchMealDbRecipes(
  query: string,
  offset = 0,
  limit = 3,
): Promise<SearchRecipesOutput> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return {
      query,
      found: false,
      totalMatches: 0,
      offset,
      recipes: [],
    };
  }

  let rawMeals = await fetchMealDbByTerm(cleanQuery);
  let searchedAs: string | undefined;

  // Fallback A: US -> UK synonym translation
  if (rawMeals.length === 0) {
    const translated = translateSynonyms(cleanQuery);
    if (translated) {
      const synonymMeals = await fetchMealDbByTerm(translated);
      if (synonymMeals.length > 0) {
        rawMeals = synonymMeals;
        searchedAs = translated;
      }
    }
  }

  // Fallback B: Multi-word split & match scoring (e.g. "spaghetti carbonara")
  if (rawMeals.length === 0) {
    rawMeals = await searchMultiWordMatches(cleanQuery);
  }

  const totalMatches = rawMeals.length;
  const normalizedMeals = rawMeals
    .slice(offset, offset + limit)
    .map(normalizeMealDbRecord);

  return {
    query,
    translatedQuery: searchedAs,
    found: totalMatches > 0,
    totalMatches,
    offset,
    recipes: normalizedMeals,
  };
}

export async function getMealDbRecipeById(
  id: string,
): Promise<NormalizedMealDbRecipe | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const meals = await fetchMealDbRecords(
    `lookup.php?i=${encodeURIComponent(trimmed)}`,
  );
  return meals[0] ? normalizeMealDbRecord(meals[0]) : null;
}
