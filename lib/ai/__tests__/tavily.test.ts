import { describe, it, expect } from "vitest";
import { extractWebPage, searchWebPage } from "@/lib/ai/tavily";

describe("searchWebPage", () => {
  it("returns unconfigured when TAVILY_API_KEY is missing", async () => {
    const result = await searchWebPage("best substitute for buttermilk", {
      apiKey: "",
    });

    expect(result.status).toBe("unconfigured");
    expect(result.query).toBe("best substitute for buttermilk");
  });

  it("sends a basic Tavily search request and normalizes results", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const stubFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          query: "buttermilk substitute",
          results: [
            {
              title: "How to Make a Buttermilk Substitute",
              url: "https://www.seriouseats.com/buttermilk-substitute",
              content:
                "Mix 1 cup milk with 1 tablespoon lemon juice or vinegar.",
              score: 0.94,
            },
            {
              title: "Missing URL Result",
              url: "",
              content: "Should be skipped.",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await searchWebPage("buttermilk substitute", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(capturedUrl).toBe("https://api.tavily.com/search");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer tvly-test-key",
    });
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      query: "buttermilk substitute",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    });

    expect(result).toEqual({
      status: "success",
      query: "buttermilk substitute",
      results: [
        {
          title: "How to Make a Buttermilk Substitute",
          url: "https://www.seriouseats.com/buttermilk-substitute",
          snippet: "Mix 1 cup milk with 1 tablespoon lemon juice or vinegar.",
        },
      ],
    });
  });

  it("returns no-results when Tavily returns an empty results array", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ query: "xyz", results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await searchWebPage("xyz", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(result.status).toBe("no-results");
  });

  it("returns error when Tavily responds with a non-OK HTTP status", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });

    const result = await searchWebPage("beef rendang", {
      apiKey: "tvly-bad-key",
      fetchFn: stubFetch,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("401");
    }
  });
});

describe("extractWebPage", () => {
  it("returns unconfigured when TAVILY_API_KEY is missing", async () => {
    const result = await extractWebPage("https://example.com/recipe", {
      apiKey: "",
    });

    expect(result.status).toBe("unconfigured");
  });

  it("sends a basic Tavily extract request and returns trimmed markdown content", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const stubFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          results: [
            {
              url: "https://example.com/martabak",
              raw_content:
                "  # Martabak Manis\nIngredients: flour, eggs, sugar  ",
            },
          ],
          failed_results: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await extractWebPage("https://example.com/martabak", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(capturedUrl).toBe("https://api.tavily.com/extract");
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      urls: ["https://example.com/martabak"],
      extract_depth: "basic",
      format: "markdown",
      include_images: false,
      timeout: 10,
    });
    expect(result).toEqual({
      status: "success",
      url: "https://example.com/martabak",
      content: "# Martabak Manis\nIngredients: flour, eggs, sugar",
    });
  });

  it("returns error when Tavily reports the URL in failed_results", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [],
          failed_results: [
            { url: "https://example.com/slow", error: "Timeout" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    const result = await extractWebPage("https://example.com/slow", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(result).toEqual({
      status: "error",
      message: "Timeout",
    });
  });

  it("returns error when Tavily extract returns a non-OK HTTP status", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });

    const result = await extractWebPage("https://example.com/recipe", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("500");
    }
  });
});
