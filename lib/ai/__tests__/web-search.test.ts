import { describe, it, expect } from "vitest";
import { searchCookingWeb } from "@/lib/ai/web-search";

describe("searchCookingWeb", () => {
  it("returns unconfigured when TAVILY_API_KEY is missing", async () => {
    const result = await searchCookingWeb("best substitute for buttermilk", {
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
              content: "Mix 1 cup milk with 1 tablespoon lemon juice or vinegar.",
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

    const result = await searchCookingWeb("buttermilk substitute", {
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

    const result = await searchCookingWeb("xyz", {
      apiKey: "tvly-test-key",
      fetchFn: stubFetch,
    });

    expect(result.status).toBe("no-results");
  });

  it("returns error when Tavily responds with a non-OK HTTP status", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });

    const result = await searchCookingWeb("beef rendang", {
      apiKey: "tvly-bad-key",
      fetchFn: stubFetch,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("401");
    }
  });
});
