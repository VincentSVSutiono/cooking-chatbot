const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
const MAX_EXTRACTED_CONTENT_CHARS = 15000;

export interface SearchWebPageSource {
  title: string;
  url: string;
  snippet: string;
}

export type SearchWebPageOutput =
  | { status: "success"; query: string; results: SearchWebPageSource[] }
  | { status: "no-results"; query: string; message: string }
  | { status: "unconfigured"; query: string; message: string }
  | { status: "error"; query: string; message: string };

export type ExtractWebPageOutput =
  | { status: "success"; url: string; content: string }
  | { status: "unconfigured"; message: string }
  | { status: "error"; message: string };

interface TavilySearchResultItem {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

interface TavilySearchResponse {
  results?: TavilySearchResultItem[];
}

interface TavilyExtractResultItem {
  url?: unknown;
  raw_content?: unknown;
}

interface TavilyExtractFailedItem {
  url?: unknown;
  error?: unknown;
}

interface TavilyExtractResponse {
  results?: TavilyExtractResultItem[];
  failed_results?: TavilyExtractFailedItem[];
}

export interface TavilyRequestOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
}

/**
 * Queries Tavily's basic search endpoint (1 credit/query) for cooking facts
 * or fallback recipe results when TheMealDB has no match.
 */
export async function searchWebPage(
  rawQuery: string,
  options: TavilyRequestOptions = {},
): Promise<SearchWebPageOutput> {
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

    const payload = (await res.json()) as TavilySearchResponse;
    const rawResults = Array.isArray(payload.results) ? payload.results : [];

    const results: SearchWebPageSource[] = rawResults
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

/**
 * Fallback page extractor using Tavily's basic `/extract` endpoint (1 credit
 * per 5 successful URLs; 0 credits on failure) when direct HTML fetch times out
 * or hits a transient network/5xx error.
 */
export async function extractWebPage(
  rawUrl: string,
  options: TavilyRequestOptions = {},
): Promise<ExtractWebPageOutput> {
  const url = rawUrl.trim();
  const apiKey = (options.apiKey ?? process.env.TAVILY_API_KEY ?? "").trim();
  const fetchFn = options.fetchFn ?? fetch;

  if (!apiKey) {
    return {
      status: "unconfigured",
      message: "Web extraction fallback is not configured (missing TAVILY_API_KEY).",
    };
  }

  try {
    const res = await fetchFn(TAVILY_EXTRACT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: [url],
        extract_depth: "basic",
        format: "markdown",
        include_images: false,
        timeout: 10,
      }),
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `Web extraction failed: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const payload = (await res.json()) as TavilyExtractResponse;
    const extracted = Array.isArray(payload.results) ? payload.results[0] : undefined;
    const rawContent =
      typeof extracted?.raw_content === "string"
        ? extracted.raw_content.trim().slice(0, MAX_EXTRACTED_CONTENT_CHARS)
        : "";

    if (rawContent) {
      return {
        status: "success",
        url:
          typeof extracted?.url === "string" && extracted.url.trim()
            ? extracted.url.trim()
            : url,
        content: rawContent,
      };
    }

    const failedReason =
      Array.isArray(payload.failed_results) &&
      typeof payload.failed_results[0]?.error === "string"
        ? payload.failed_results[0].error.trim()
        : "";

    return {
      status: "error",
      message: failedReason || "Could not extract readable content from that URL.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Web extraction request failed.",
    };
  }
}
