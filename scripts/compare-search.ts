import {
  searchRecipesByKeywordInDb,
  searchRecipesInDb,
} from "@/lib/db/recipes";

interface BenchmarkQuery {
  label: string;
  query: string;
}

const BENCHMARK_QUERIES: BenchmarkQuery[] = [
  { label: "Exact dish name", query: "spaghetti carbonara" },
  {
    label: "Vibe / mood",
    query: "something warm and comforting with chicken",
  },
  {
    label: "Multi-ingredient list",
    query: "chicken, garlic, ginger, soy sauce",
  },
  {
    label: "Texture + dietary + ingredients",
    query: "crispy vegetarian dinner with potatoes and spices",
  },
  {
    label: "US-to-UK culinary vocabulary",
    query: "eggplant parmesan",
  },
  {
    label: "Flavor / dessert description",
    query: "sweet chocolate dessert with strawberries",
  },
];

function formatKeywordCell(
  result: Awaited<ReturnType<typeof searchRecipesByKeywordInDb>>,
): string {
  if (!result.found || result.recipes.length === 0) {
    return "0 matches";
  }

  const titles = result.recipes
    .slice(0, 3)
    .map((recipe) => recipe.title)
    .join("; ");
  const translatedNote = result.translatedQuery
    ? ` (via "${result.translatedQuery}")`
    : "";
  return `${result.totalMatches} total${translatedNote}: ${titles}`;
}

function formatVectorCell(
  result: Awaited<ReturnType<typeof searchRecipesInDb>>,
): string {
  if (!result.found || result.recipes.length === 0) {
    return "0 matches";
  }

  const matches = result.recipes
    .slice(0, 3)
    .map((recipe) => {
      const score =
        typeof recipe.similarity === "number"
          ? recipe.similarity.toFixed(2)
          : "n/a";
      return `${recipe.title} (${score})`;
    })
    .join("; ");
  return `${result.totalMatches} total: ${matches}`;
}

function buildTakeaway(
  keywordCount: number,
  vectorCount: number,
  topSimilarity?: number,
): string {
  if (keywordCount === 0 && vectorCount > 0) {
    return `Vector finds ${vectorCount} semantic matches (${topSimilarity?.toFixed(2) ?? "n/a"} top) where keyword returns 0.`;
  }
  if (keywordCount > 0 && vectorCount > 0) {
    return `Both match; vector ranks by meaning (${topSimilarity?.toFixed(2) ?? "n/a"} top) alongside title boost.`;
  }
  if (keywordCount === 0 && vectorCount === 0) {
    return "Neither search matched above threshold.";
  }
  return "Keyword matched title substring while vector fell below threshold.";
}

async function main() {
  console.log("Running 6-query Keyword vs. Vector Search benchmark...\n");

  const rows: string[] = [
    "| Category | Query | Keyword Search (top 3) | Vector Search (top 3, cosine) | Takeaway |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const item of BENCHMARK_QUERIES) {
    const [keywordRes, vectorRes] = await Promise.all([
      searchRecipesByKeywordInDb(item.query, 0, 3),
      searchRecipesInDb(item.query, 0, 3),
    ]);

    const topSimilarity = vectorRes.recipes[0]?.similarity;
    const takeaway = buildTakeaway(
      keywordRes.totalMatches,
      vectorRes.totalMatches,
      topSimilarity,
    );

    rows.push(
      `| ${item.label} | \`${item.query}\` | ${formatKeywordCell(keywordRes)} | ${formatVectorCell(vectorRes)} | ${takeaway} |`,
    );
  }

  console.log(rows.join("\n"));
}

main().catch((error) => {
  console.error("Search benchmark script failed:", error);
  process.exit(1);
});
