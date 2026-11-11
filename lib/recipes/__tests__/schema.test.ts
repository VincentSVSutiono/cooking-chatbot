import { describe, it, expect } from "vitest";
import { validateRecipe, type StructuredRecipe } from "@/lib/recipes/schema";

function createValidRecipe(
  overrides: Partial<StructuredRecipe> = {},
): StructuredRecipe {
  return {
    id: "52982",
    title: "Spaghetti Alla Carbonara",
    ingredients: [
      { item: "Spaghetti", amount: "400g" },
      { item: "Guanciale", amount: "150g" },
      { item: "Egg Yolks", amount: "6" },
      { item: "Pecorino Romano", amount: "50g" },
      { item: "Black Pepper", amount: "" },
    ],
    steps: [
      "Bring a large pot of salted water to a rolling boil (big bubbles rising constantly).",
      "Cut the guanciale into small strips and crisp them gently in a dry skillet over medium-low heat.",
      "Whisk the egg yolks and finely grated Pecorino together in a bowl until thick.",
    ],
    times: {
      prep: "10 minutes",
      cook: "15 minutes",
      total: "25 minutes",
    },
    safetyNote:
      "Toss the eggs off the heat so residual warmth thickens the sauce gently.",
    source: {
      name: "TheMealDB",
      url: "https://www.themealdb.com/meal/52982",
      creditText: "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)",
      thumbnailUrl:
        "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg",
      youtubeUrl: "https://www.youtube.com/watch?v=3AAdKl1UYZs",
      category: "Pasta",
      area: "Italian",
    },
    ...overrides,
  };
}

describe("validateRecipe", () => {
  it("accepts a complete valid recipe with times, safetyNote, and youtubeUrl", () => {
    const input = createValidRecipe();

    const result = validateRecipe(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Spaghetti Alla Carbonara");
      expect(result.data.ingredients).toHaveLength(5);
      expect(result.data.source.youtubeUrl).toBe(
        "https://www.youtube.com/watch?v=3AAdKl1UYZs",
      );
    }
  });

  it("accepts a recipe when optional/unreported fields (times, safetyNote, youtubeUrl, thumbnailUrl) are null", () => {
    const input = createValidRecipe({
      times: {
        prep: null,
        cook: null,
        total: null,
      },
      safetyNote: null,
      source: {
        name: "TheMealDB",
        url: "https://www.themealdb.com/meal/52982",
        creditText:
          "Recipe data and imagery: TheMealDB (https://www.themealdb.com/)",
        thumbnailUrl: null,
        youtubeUrl: null,
        category: null,
        area: null,
      },
    });

    const result = validateRecipe(input);

    expect(result.success).toBe(true);
  });

  it("rejects a recipe with an empty or whitespace-only title", () => {
    const input = createValidRecipe({ title: "   " });

    const result = validateRecipe(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("rejects a recipe with an empty ingredients array", () => {
    const input = createValidRecipe({ ingredients: [] });

    const result = validateRecipe(input);

    expect(result.success).toBe(false);
  });

  it("rejects a recipe with an empty steps array", () => {
    const input = createValidRecipe({ steps: [] });

    const result = validateRecipe(input);

    expect(result.success).toBe(false);
  });

  it("rejects a recipe when steps is a single string instead of an array of strings", () => {
    const malformed = {
      ...createValidRecipe(),
      steps: "Step 1: Boil pasta. Step 2: Fry guanciale.",
    };

    const result = validateRecipe(malformed);

    expect(result.success).toBe(false);
  });

  it("rejects a recipe when source.url or source.creditText is missing or invalid", () => {
    const badUrl = createValidRecipe({
      source: {
        ...createValidRecipe().source,
        url: "not-a-valid-url",
      },
    });
    const emptyCredit = createValidRecipe({
      source: {
        ...createValidRecipe().source,
        creditText: "",
      },
    });

    expect(validateRecipe(badUrl).success).toBe(false);
    expect(validateRecipe(emptyCredit).success).toBe(false);
  });
});
