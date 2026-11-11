import { describe, it, expect } from "vitest";
import { normalizeMealRecord, translateSynonyms } from "@/lib/recipes/search";

describe("normalizeMealRecord", () => {
  it("extracts non-empty ingredient and measure pairs up to 20", () => {
    const raw = {
      idMeal: "52772",
      strMeal: "Teriyaki Chicken Casserole",
      strCategory: "Chicken",
      strArea: "Japanese",
      strInstructions: "Bake at 350F for 30 minutes.",
      strMealThumb: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
      strSource: "https://example.com/recipe",
      strYoutube: "https://www.youtube.com/watch?v=4aZr5hZXP_s",
      strIngredient1: "soy sauce",
      strMeasure1: "3/4 cup",
      strIngredient2: "water",
      strMeasure2: "1/2 cup",
      strIngredient3: "   ", // whitespace only, should be omitted
      strMeasure3: "1 cup",
      strIngredient4: "", // empty, should be omitted
      strMeasure4: "2 tbsp",
      strIngredient5: null, // null, should be omitted
      strMeasure5: null,
      strIngredient6: "chicken breasts",
      strMeasure6: "2 pounds",
    };

    const normalized = normalizeMealRecord(raw);

    expect(normalized.id).toBe("52772");
    expect(normalized.name).toBe("Teriyaki Chicken Casserole");
    expect(normalized.category).toBe("Chicken");
    expect(normalized.area).toBe("Japanese");
    expect(normalized.instructions).toBe("Bake at 350F for 30 minutes.");
    expect(normalized.mealUrl).toBe("https://www.themealdb.com/meal/52772");
    expect(normalized.sourceUrl).toBe("https://example.com/recipe");
    expect(normalized.youtubeUrl).toBe("https://www.youtube.com/watch?v=4aZr5hZXP_s");

    // Only non-empty ingredients should be included
    expect(normalized.ingredients).toEqual([
      { item: "soy sauce", measure: "3/4 cup" },
      { item: "water", measure: "1/2 cup" },
      { item: "chicken breasts", measure: "2 pounds" },
    ]);
  });

  it("handles empty or missing meal attributes gracefully", () => {
    const raw = {};
    const normalized = normalizeMealRecord(raw);

    expect(normalized.id).toBe("");
    expect(normalized.name).toBe("Untitled Recipe");
    expect(normalized.category).toBeNull();
    expect(normalized.area).toBeNull();
    expect(normalized.instructions).toBe("");
    expect(normalized.ingredients).toEqual([]);
    expect(normalized.thumbnailUrl).toBeNull();
    expect(normalized.sourceUrl).toBeNull();
    expect(normalized.youtubeUrl).toBeNull();
  });
});

describe("translateSynonyms", () => {
  it("translates US culinary terms to UK equivalents used in TheMealDB", () => {
    expect(translateSynonyms("grilled eggplant")).toBe("grilled aubergine");
    expect(translateSynonyms("zucchini pasta")).toBe("courgette pasta");
    expect(translateSynonyms("cilantro lime rice")).toBe("coriander lime rice");
    expect(translateSynonyms("garlic shrimp")).toBe("garlic prawn");
    expect(translateSynonyms("fresh arugula salad")).toBe("fresh rocket salad");
  });

  it("returns null when no synonyms match the query", () => {
    expect(translateSynonyms("chicken curry")).toBeNull();
    expect(translateSynonyms("beef stew")).toBeNull();
  });

  it("respects word boundaries and avoids partial-word replacements", () => {
    // "shrimpy" should not become "prawny"
    expect(translateSynonyms("shrimpy dip")).toBeNull();
  });
});
