import {
  embedRecipeDocumentsBatch,
  formatRecipeForEmbedding,
} from "@/lib/ai/embeddings";
import {
  countRecipesBySourceType,
  listSeededMealDbIds,
  upsertMealDbRecipesBatch,
} from "@/lib/db/recipes";
import {
  normalizeMealDbRecord,
  THEMEALDB_BASE_URL,
  THEMEALDB_CREDIT_TEXT,
  type NormalizedMealDbRecipe,
} from "@/lib/recipes/mealdb";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
const BATCH_SIZE = 40;
// Google AI Studio free tier for gemini-embedding-2 is 30,000 TPM / 100 RPM / 1,000 RPD.
// Keep a safety buffer below 30,000 TPM because @ai-sdk/google reports usage.tokens = NaN.
const MAX_ESTIMATED_TOKENS_PER_MINUTE = 24_000;
const WINDOW_MS = 61_000;
const MAX_EMBED_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateBatchTokens(recipes: NormalizedMealDbRecipe[]): number {
  let totalChars = 0;
  for (const recipe of recipes) {
    totalChars += formatRecipeForEmbedding(recipe).length;
  }
  // Conservative ~3.5 chars/token heuristic leaves headroom under the 30k TPM cap.
  return Math.ceil(totalChars / 3.5);
}

function isRetryableRateLimitOrTransientError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("503") ||
    message.includes("500") ||
    message.includes("timeout") ||
    message.includes("network")
  );
}

async function fetchAllMealDbRecipes(): Promise<NormalizedMealDbRecipe[]> {
  const recipeMap = new Map<string, NormalizedMealDbRecipe>();
  let skippedMalformed = 0;

  for (const letter of ALPHABET) {
    const url = `${THEMEALDB_BASE_URL}/search.php?f=${letter}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `TheMealDB fetch failed for letter "${letter}" with HTTP ${res.status}`,
      );
    }

    const data = (await res.json()) as { meals?: unknown };
    const meals = Array.isArray(data.meals)
      ? (data.meals as Record<string, unknown>[])
      : [];

    for (const raw of meals) {
      const normalized = normalizeMealDbRecord(raw);
      const hasValidTitle =
        typeof raw.strMeal === "string" && raw.strMeal.trim().length > 0;
      const hasValidInstructions = normalized.instructions.trim().length > 0;

      if (!normalized.id || !hasValidTitle || !hasValidInstructions) {
        skippedMalformed += 1;
        continue;
      }

      if (!recipeMap.has(normalized.id)) {
        recipeMap.set(normalized.id, {
          ...normalized,
          sourceName: "TheMealDB",
          creditText: THEMEALDB_CREDIT_TEXT,
        });
      }
    }
  }

  if (skippedMalformed > 0) {
    console.warn(`Skipped ${skippedMalformed} malformed MealDB record(s).`);
  }

  return Array.from(recipeMap.values());
}

async function embedBatchWithRetry(
  batch: NormalizedMealDbRecipe[],
): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    try {
      return await embedRecipeDocumentsBatch(batch);
    } catch (error) {
      attempt += 1;
      if (
        attempt > MAX_EMBED_RETRIES ||
        !isRetryableRateLimitOrTransientError(error)
      ) {
        throw error;
      }

      const backoffMs = Math.min(90_000, 15_000 * 2 ** (attempt - 1));
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        `Embedding batch failed (${detail}). Retrying attempt ${attempt}/${MAX_EMBED_RETRIES} in ${Math.round(backoffMs / 1000)}s...`,
      );
      await sleep(backoffMs);
    }
  }
}

async function main() {
  const isForce = process.argv.includes("--force");
  const startedAt = Date.now();

  console.log(
    `Fetching MealDB recipes across a-z (${isForce ? "--force rebuild" : "resumable"} mode)...`,
  );
  const allRecipes = await fetchAllMealDbRecipes();
  const existingIds = await listSeededMealDbIds();

  const targetRecipes = isForce
    ? allRecipes
    : allRecipes.filter((recipe) => !existingIds.has(recipe.id));

  console.log(
    `Fetched ${allRecipes.length} unique MealDB recipes. Already seeded: ${existingIds.size}. Remaining to embed: ${targetRecipes.length}.`,
  );

  if (targetRecipes.length === 0) {
    const counts = await countRecipesBySourceType();
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `Nothing to embed (${elapsedSec}s). DB totals -> mealdb: ${counts.mealdb}, web (untouched): ${counts.web}.`,
    );
    return;
  }

  const totalBatches = Math.ceil(targetRecipes.length / BATCH_SIZE);
  let windowStartMs = Date.now();
  let tokensInWindow = 0;
  let processedCount = 0;

  for (let i = 0; i < targetRecipes.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const batch = targetRecipes.slice(i, i + BATCH_SIZE);
    const estimatedTokens = estimateBatchTokens(batch);

    const now = Date.now();
    if (now - windowStartMs >= WINDOW_MS) {
      windowStartMs = now;
      tokensInWindow = 0;
    }

    if (
      tokensInWindow > 0 &&
      tokensInWindow + estimatedTokens > MAX_ESTIMATED_TOKENS_PER_MINUTE
    ) {
      const waitMs = Math.max(0, WINDOW_MS - (now - windowStartMs));
      console.log(
        `[Pacer] ~${tokensInWindow} tokens sent in current window; waiting ${Math.ceil(waitMs / 1000)}s before batch ${batchIndex}/${totalBatches} (~${estimatedTokens} tokens)...`,
      );
      await sleep(waitMs);
      windowStartMs = Date.now();
      tokensInWindow = 0;
    }

    const vectors = await embedBatchWithRetry(batch);
    tokensInWindow += estimatedTokens;

    const entries = batch.map((recipe, idx) => ({
      recipe,
      embedding: vectors[idx],
    }));

    await upsertMealDbRecipesBatch(entries);
    processedCount += batch.length;

    console.log(
      `[Batch ${batchIndex}/${totalBatches}] Embedded & upserted ${processedCount}/${targetRecipes.length} recipes (~${estimatedTokens} est. tokens).`,
    );
  }

  const counts = await countRecipesBySourceType();
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("\n=== Seed Summary ===");
  console.log(`Total MealDB recipes fetched: ${allRecipes.length}`);
  console.log(`Newly seeded/updated: ${processedCount}`);
  console.log(`DB mealdb rows: ${counts.mealdb}`);
  console.log(`DB saved web rows (untouched): ${counts.web}`);
  console.log(`Elapsed: ${elapsedSec}s`);
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
