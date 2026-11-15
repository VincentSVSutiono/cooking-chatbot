import type { WebSearchOutput, WebSearchSource } from "./types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

interface TavilyResultItem {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

interface TavilyResponsePayload {
  results?: TavilyResultItem[];
}

export interface SearchCookingWebOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
}

/**
 * Queries Tavily's basic search endpoint (1 credit/query) for cooking facts
 * or fallback recipe results when TheMealDB has no match.
 */
export async function searchCookingWeb(
  rawQuery: string,
  options: SearchCookingWebOptions = {},
): Promise<WebSearchOutput> {
  const query = rawQuery.trim();
  const apiKey = (options.apiKey ?? process.env.TAVILY_API_KEY ?? "").trim();
  const fetchFn = options.fetchFn ?? fetch;

  if (!apiKey) {
    return {
      status: "unconfigured",
      query,
      message:
        "Web search is not configured yet (missing TAVILY_API_KEY). Ask about a dish in TheMealDB or paste a recipe URL instead.",
    };
  }

  try {
    const res = await fetchFn(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      return {
        status: "error",
        query,
        message: `Web search failed: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const payload = (await res.json()) as TavilyResponsePayload;
    const rawResults = Array.isArray(payload.results) ? payload.results : [];

    const results: WebSearchSource[] = rawResults
      .filter(
        (item): item is { title?: unknown; url: string; content?: unknown } =>
          typeof item.url === "string" && item.url.trim().length > 0,
      )
      .map((item) => ({
        title:
          typeof item.title === "string" && item.title.trim()
            ? item.title.trim()
            : item.url.trim(),
        url: item.url.trim(),
        snippet:
          typeof item.content === "string" ? item.content.trim().slice(0, 600) : "",
      }));

    if (results.length === 0) {
      return {
        status: "no-results",
        query,
        message: `No web results found for "${query}".`,
      };
    }

    return {
      status: "success",
      query,
      results,
    };
  } catch (error) {
    return {
      status: "error",
      query,
      message:
        error instanceof Error ? error.message : "Web search request failed.",
    };
  }
}
