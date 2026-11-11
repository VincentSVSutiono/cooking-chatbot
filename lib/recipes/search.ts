export interface RecipeIngredient {
  item: string;
  measure: string;
}

export interface NormalizedRecipe {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  instructions: string;
  ingredients: RecipeIngredient[];
  thumbnailUrl: string | null;
  mealUrl: string;
  sourceUrl: string | null;
  youtubeUrl: string | null;
}

export interface DishSearchResult {
  query: string;
  translatedQuery?: string;
  found: boolean;
  totalMatches: number;
  offset: number;
  recipes: NormalizedRecipe[];
}

type RawMealRecord = Record<string, unknown>;

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeMealRecord(raw: RawMealRecord): NormalizedRecipe {
  const id = toNonEmptyString(raw.idMeal) ?? "";
  const ingredients: RecipeIngredient[] = [];

  for (let i = 1; i <= 20; i++) {
    const item = toNonEmptyString(raw[`strIngredient${i}`]);
    const measure = toNonEmptyString(raw[`strMeasure${i}`]) ?? "";
    if (item) ingredients.push({ item, measure });
  }

  return {
    id,
    name: toNonEmptyString(raw.strMeal) ?? "Untitled Recipe",
    category: toNonEmptyString(raw.strCategory),
    area: toNonEmptyString(raw.strArea),
    instructions: toNonEmptyString(raw.strInstructions) ?? "",
    ingredients,
    thumbnailUrl: toNonEmptyString(raw.strMealThumb),
    mealUrl: `https://www.themealdb.com/meal/${id}`,
    sourceUrl: toNonEmptyString(raw.strSource),
    youtubeUrl: toNonEmptyString(raw.strYoutube),
  };
}

const THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1";

async function fetchMealRecords(endpoint: string): Promise<RawMealRecord[]> {
  try {
    const res = await fetch(`${THEMEALDB_BASE_URL}/${endpoint}`);
    if (!res.ok) return [];

    const data = (await res.json()) as { meals?: unknown };
    return Array.isArray(data.meals) ? (data.meals as RawMealRecord[]) : [];
  } catch (error) {
    console.error(`TheMealDB fetch error (${endpoint}):`, error);
    return [];
  }
}

async function fetchMealsByTerm(term: string): Promise<RawMealRecord[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  return fetchMealRecords(`search.php?s=${encodeURIComponent(trimmed)}`);
}

// Only US to UK and not the other way is because the MealDB data is based of british culture
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

async function searchMultiWordMatches(query: string): Promise<RawMealRecord[]> {
  const terms = query.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length <= 1) return [];

  const termResults = await Promise.all(
    terms.map((term) => fetchMealsByTerm(term)),
  );
  const mealMap = new Map<string, RawMealRecord>();

  for (const result of termResults) {
    for (const meal of result) {
      const id = String(meal.idMeal ?? "");
      if (id && !mealMap.has(id)) {
        mealMap.set(id, meal);
      }
    }
  }

  // Enforce meaningful overlap to prevent single incidental keyword false-positives
  // For a 2-word query ("spaghetti carbonara"), both words must appear in the title.
  // For 3+ words, at least 2 words or >= 50% of the query terms must appear in the title.
  const minRequiredMatches =
    terms.length === 2 ? 2 : Math.max(2, Math.ceil(terms.length * 0.5));

  // Score candidates by how many query words appear in their meal title
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

export async function searchRecipesByName(
  query: string,
  offset = 0,
  limit = 3,
): Promise<DishSearchResult> {
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

  let rawMeals = await fetchMealsByTerm(cleanQuery);
  let searchedAs: string | undefined;

  // 2. Fallback A: US -> UK synonym translation
  if (rawMeals.length === 0) {
    const translated = translateSynonyms(cleanQuery);
    if (translated) {
      const synonymMeals = await fetchMealsByTerm(translated);
      if (synonymMeals.length > 0) {
        rawMeals = synonymMeals;
        searchedAs = translated;
      }
    }
  }

  // 3. Fallback B: Multi-word split & match scoring (e.g. "spaghetti carbonara")
  if (rawMeals.length === 0) {
    rawMeals = await searchMultiWordMatches(cleanQuery);
  }

  const totalMatches = rawMeals.length;
  const normalizedMeals = rawMeals
    .slice(offset, offset + limit)
    .map(normalizeMealRecord);

  return {
    query,
    translatedQuery: searchedAs,
    found: totalMatches > 0,
    totalMatches,
    offset,
    recipes: normalizedMeals,
  };
}

export async function lookupRecipeById(
  id: string,
): Promise<NormalizedRecipe | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const meals = await fetchMealRecords(
    `lookup.php?i=${encodeURIComponent(trimmed)}`,
  );
  return meals[0] ? normalizeMealRecord(meals[0]) : null;
}
