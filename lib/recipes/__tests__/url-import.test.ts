import { describe, it, expect } from "vitest";
import {
  isPrivateOrReservedIp,
  assertSafeRecipeUrl,
  fetchSafeRecipeHtml,
  extractRecipeFromHtml,
} from "@/lib/recipes/url-import";

describe("isPrivateOrReservedIp", () => {
  it("identifies loopback, private, link-local, and reserved IPv4 addresses as unsafe", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.255.255.254")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.100")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("224.0.0.1")).toBe(true);
  });

  it("identifies loopback, unique-local, link-local, and IPv4-mapped private IPv6 addresses as unsafe", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("::")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:192.168.1.1")).toBe(true);
  });

  it("allows valid public unicast IPv4 and IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
    expect(isPrivateOrReservedIp("172.15.255.255")).toBe(false);
    expect(isPrivateOrReservedIp("172.32.0.1")).toBe(false);
    expect(isPrivateOrReservedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(
      false,
    );
  });
});

describe("assertSafeRecipeUrl", () => {
  const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

  it("accepts a valid https URL that resolves to a public IP", async () => {
    const url = await assertSafeRecipeUrl(
      "https://www.seriouseats.com/classic-pancakes-recipe",
      publicLookup,
    );
    expect(url.href).toBe("https://www.seriouseats.com/classic-pancakes-recipe");
  });

  it("rejects non-http(s) schemes such as file:, ftp:, or javascript:", async () => {
    await expect(
      assertSafeRecipeUrl("file:///etc/passwd", publicLookup),
    ).rejects.toThrow(/http/i);
    await expect(
      assertSafeRecipeUrl("ftp://example.com/recipe.txt", publicLookup),
    ).rejects.toThrow(/http/i);
    await expect(
      assertSafeRecipeUrl("javascript:alert(1)", publicLookup),
    ).rejects.toThrow(/http/i);
  });

  it("rejects localhost and .local / .internal hostnames", async () => {
    await expect(
      assertSafeRecipeUrl("http://localhost:3000/api/chat", publicLookup),
    ).rejects.toThrow(/local|private/i);
    await expect(
      assertSafeRecipeUrl("http://kitchen.local/recipe", publicLookup),
    ).rejects.toThrow(/local|private/i);
    await expect(
      assertSafeRecipeUrl("http://metadata.internal/secret", publicLookup),
    ).rejects.toThrow(/local|private/i);
  });

  it("rejects direct loopback, private, and cloud metadata IP literals", async () => {
    await expect(
      assertSafeRecipeUrl("http://127.0.0.1:8080/recipe", publicLookup),
    ).rejects.toThrow(/private|local|reserved/i);
    await expect(
      assertSafeRecipeUrl(
        "http://169.254.169.254/latest/meta-data/",
        publicLookup,
      ),
    ).rejects.toThrow(/private|local|reserved/i);
    await expect(
      assertSafeRecipeUrl("http://[::1]:3000/recipe", publicLookup),
    ).rejects.toThrow(/private|local|reserved/i);
  });

  it("rejects a domain whose DNS record resolves to a private or loopback IP", async () => {
    const rebindLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];

    await expect(
      assertSafeRecipeUrl("https://sneaky-domain.example.com/recipe", rebindLookup),
    ).rejects.toThrow(/private|local|reserved/i);
  });
});

describe("extractRecipeFromHtml", () => {
  it("extracts a Schema.org Recipe from a standard JSON-LD script block", () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Best Fluffy Pancakes - Sunny Kitchen</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Best Fluffy Pancakes",
              "image": ["https://sunnykitchen.example.com/pancakes.jpg"],
              "prepTime": "PT10M",
              "cookTime": "PT15M",
              "totalTime": "PT25M",
              "recipeCategory": "Breakfast",
              "recipeCuisine": "American",
              "recipeIngredient": [
                "1 1/2 cups all-purpose flour",
                "3 1/2 teaspoons baking powder",
                "1 cup milk"
              ],
              "recipeInstructions": [
                {
                  "@type": "HowToStep",
                  "text": "Whisk flour and baking powder together in a large bowl."
                },
                {
                  "@type": "HowToStep",
                  "text": "Pour in the milk and stir until just combined."
                }
              ]
            }
          </script>
        </head>
        <body><h1>Best Fluffy Pancakes</h1></body>
      </html>
    `;

    const result = extractRecipeFromHtml(
      html,
      "https://sunnykitchen.example.com/fluffy-pancakes",
    );

    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.title).toBe("Best Fluffy Pancakes");
      expect(result.ingredients).toEqual([
        "1 1/2 cups all-purpose flour",
        "3 1/2 teaspoons baking powder",
        "1 cup milk",
      ]);
      expect(result.rawInstructions).toContain("Whisk flour and baking powder");
      expect(result.prepTime).toBe("10 minutes");
      expect(result.cookTime).toBe("15 minutes");
      expect(result.totalTime).toBe("25 minutes");
      expect(result.imageUrl).toBe(
        "https://sunnykitchen.example.com/pancakes.jpg",
      );
      expect(result.category).toBe("Breakfast");
      expect(result.area).toBe("American");
    }
  });

  it("extracts a Recipe nested inside a JSON-LD @graph array with array @type", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                { "@type": "WebPage", "name": "Blog Post" },
                {
                  "@type": ["Recipe", "NewsArticle"],
                  "name": "Simple Garlic Pasta",
                  "recipeIngredient": ["200g spaghetti", "4 cloves garlic"],
                  "recipeInstructions": "Boil spaghetti. Gently fry sliced garlic in olive oil."
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractRecipeFromHtml(
      html,
      "https://pasta.example.com/garlic-pasta",
    );

    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.title).toBe("Simple Garlic Pasta");
      expect(result.ingredients).toEqual(["200g spaghetti", "4 cloves garlic"]);
      expect(result.rawInstructions).toContain("Gently fry sliced garlic");
    }
  });

  it("falls back to cleaned visible page text when no JSON-LD Recipe is present", () => {
    const html = `
      <html>
        <head>
          <title>Grandma's Tomato Soup</title>
          <style>.hidden { display: none; }</style>
          <script>console.log("analytics");</script>
        </head>
        <body>
          <nav>Home | About</nav>
          <main>
            <h1>Grandma's Tomato Soup</h1>
            <p>Ingredients: 1 can crushed tomatoes, 2 cups vegetable broth.</p>
            <p>Simmer together for 20 minutes and blend until smooth.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(
      html,
      "https://blog.example.com/tomato-soup",
    );

    expect(result.mode).toBe("page-text");
    if (result.mode === "page-text") {
      expect(result.title).toBe("Grandma's Tomato Soup");
      expect(result.textSnippet).toContain("1 can crushed tomatoes");
      expect(result.textSnippet).not.toContain("console.log");
    }
  });
});

describe("fetchSafeRecipeHtml", () => {
  const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

  it("returns HTML and finalUrl for a valid public HTML response", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("<html><body><h1>Pasta</h1></body></html>", {
        status: 200,
        headers: { "content-type": "TEXT/HTML; charset=utf-8" },
      });

    const result = await fetchSafeRecipeHtml("https://recipes.example.com/pasta", {
      lookupFn: publicLookup,
      fetchFn: stubFetch,
    });

    expect(result.finalUrl).toBe("https://recipes.example.com/pasta");
    expect(result.html).toContain("<h1>Pasta</h1>");
  });

  it("follows a safe redirect to another public URL and returns finalUrl", async () => {
    let calls = 0;
    const stubFetch: typeof fetch = async () => {
      calls++;
      if (calls === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://recipes.example.com/new-pasta" },
        });
      }
      return new Response("<html><body><h1>New Pasta</h1></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    const result = await fetchSafeRecipeHtml("https://recipes.example.com/old-pasta", {
      lookupFn: publicLookup,
      fetchFn: stubFetch,
    });

    expect(result.finalUrl).toBe("https://recipes.example.com/new-pasta");
    expect(result.html).toContain("New Pasta");
  });

  it("refuses a redirect that points to a private or cloud metadata address", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      });

    await expect(
      fetchSafeRecipeHtml("https://recipes.example.com/sneaky-redirect", {
        lookupFn: publicLookup,
        fetchFn: stubFetch,
      }),
    ).rejects.toThrow(/private|local|reserved/i);
  });

  it("stops after more than 3 redirects", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://recipes.example.com/loop" },
      });

    await expect(
      fetchSafeRecipeHtml("https://recipes.example.com/loop", {
        lookupFn: publicLookup,
        fetchFn: stubFetch,
      }),
    ).rejects.toThrow(/too many redirects/i);
  });

  it("rejects non-HTML content types such as application/pdf", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("%PDF-1.4", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });

    await expect(
      fetchSafeRecipeHtml("https://recipes.example.com/cookbook.pdf", {
        lookupFn: publicLookup,
        fetchFn: stubFetch,
      }),
    ).rejects.toThrow(/html document/i);
  });

  it("throws a clear error when the server responds with an HTTP error status", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      });

    await expect(
      fetchSafeRecipeHtml("https://recipes.example.com/missing", {
        lookupFn: publicLookup,
        fetchFn: stubFetch,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe("extractRecipeFromHtml recipe notes extraction", () => {
  const baseJsonLd = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Test Curry",
        "recipeIngredient": ["1 small onion (Note 1b)", "1 tsp salt"],
        "recipeInstructions": "Cook onion and salt until golden."
      }
    </script>
  `;

  it("extracts full nested WP Recipe Maker notes and decodes typographic entities", () => {
    const html = `
      <html>
        <head>${baseJsonLd}</head>
        <body>
          <div class="wprm-recipe-notes-container">
            <h3 class="wprm-recipe-header">Recipe Notes:</h3>
            <div class="wprm-recipe-notes">
              <p>1a. Chillies &ndash; adjust to taste.</p>
              <p>1b. Onion: Use a brown, white or yellow onion&rsquo;s center.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://blog.example.com/curry");
    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.notesText).toContain("1a. Chillies - adjust to taste.");
      expect(result.notesText).toContain("1b. Onion: Use a brown, white or yellow onion's center.");
    }
  });

  it("extracts notes from Tasty Recipes, Mediavine, or generic recipe-notes containers", () => {
    const html = `
      <html>
        <head>${baseJsonLd}</head>
        <body>
          <section class="tasty-recipes-notes">
            <h3>Notes</h3>
            <div class="tasty-recipes-notes-body">
              <ul>
                <li>Note 1: Can substitute shallots for onion.</li>
                <li>Note 2: Store leftovers up to 3 days.</li>
              </ul>
            </div>
          </section>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://tasty.example.com/curry");
    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.notesText).toContain("Note 1: Can substitute shallots for onion.");
      expect(result.notesText).toContain("Note 2: Store leftovers up to 3 days.");
    }
  });

  it("falls back to a generic Recipe Notes heading on custom sites without plugin classes", () => {
    const html = `
      <html>
        <head>${baseJsonLd}</head>
        <body>
          <article>
            <h2>Instructions</h2>
            <p>Cook until fragrant.</p>
            <h3>Cook's Notes</h3>
            <ul>
              <li>Toast spices on low heat so they don't burn.</li>
            </ul>
            <h2>Nutrition</h2>
            <p>300 kcal</p>
          </article>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://custom.example.com/curry");
    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.notesText).toContain("Toast spices on low heat");
      expect(result.notesText).not.toContain("300 kcal");
    }
  });

  it("sets notesText to null when no recipe notes section is present", () => {
    const html = `<html><head>${baseJsonLd}</head><body><p>Just a recipe.</p></body></html>`;
    const result = extractRecipeFromHtml(html, "https://plain.example.com/curry");
    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.notesText).toBeNull();
    }
  });

  it("retains long multi-note sections (e.g. 14 detailed notes over 4,000 chars) without truncating at note 8", () => {
    const notesList = Array.from({ length: 14 }, (_, idx) => {
      const n = idx + 1;
      const padding = "Detailed preparation and storage guidance ".repeat(7);
      return `<p>Note ${n}: ${padding}end of note ${n}.</p>`;
    }).join("\n");

    const html = `
      <html>
        <head>${baseJsonLd}</head>
        <body>
          <div class="wprm-recipe-notes-container">
            <div class="wprm-recipe-notes">${notesList}</div>
          </div>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://example.com/rendang");
    expect(result.mode).toBe("json-ld");
    if (result.mode === "json-ld") {
      expect(result.notesText).toContain("Note 1:");
      expect(result.notesText).toContain("end of note 14.");
    }
  });
});

describe("extractRecipeFromHtml YouTube video extraction", () => {
  it("extracts and normalizes a YouTube video from JSON-LD VideoObject embedUrl", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Rendang",
              "recipeIngredient": ["1 lb beef"],
              "recipeInstructions": "Simmer until tender.",
              "video": {
                "@type": "VideoObject",
                "name": "How to make Rendang",
                "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://example.com/rendang");
    expect(result.youtubeUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("falls back to YouTube iframe or watch links in main HTML content while ignoring channel links and footer", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Simple Soup",
              "recipeIngredient": ["1 cup broth"],
              "recipeInstructions": "Boil for 5 minutes."
            }
          </script>
        </head>
        <body>
          <nav><a href="https://www.youtube.com/@SomeChefChannel">Subscribe</a></nav>
          <main>
            <iframe src="https://www.youtube-nocookie.com/embed/AbC123_xyZ9?autoplay=0"></iframe>
          </main>
          <footer><a href="https://youtu.be/ZZZ999aaa11">Footer Video</a></footer>
        </body>
      </html>
    `;

    const result = extractRecipeFromHtml(html, "https://example.com/soup");
    expect(result.youtubeUrl).toBe(
      "https://www.youtube.com/watch?v=AbC123_xyZ9",
    );
  });

  it("extracts youtu.be video links in page-text fallback mode and returns null when none exist", () => {
    const withVideo = `
      <html>
        <head><title>Quick Pasta</title></head>
        <body>
          <p>Boil pasta for 8 minutes.</p>
          <a href="https://youtu.be/xYz98765432?t=12">Watch on YouTube</a>
        </body>
      </html>
    `;
    const withoutVideo = `
      <html>
        <head><title>Plain Toast</title></head>
        <body>
          <p>Toast bread.</p>
          <a href="https://www.youtube.com/channel/UC12345">Chef Channel</a>
        </body>
      </html>
    `;

    expect(
      extractRecipeFromHtml(withVideo, "https://example.com/pasta").youtubeUrl,
    ).toBe("https://www.youtube.com/watch?v=xYz98765432");
    expect(
      extractRecipeFromHtml(withoutVideo, "https://example.com/toast").youtubeUrl,
    ).toBeNull();
  });
});
