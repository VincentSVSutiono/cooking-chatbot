import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type DnsLookupFn = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultDnsLookup: DnsLookupFn = (hostname) =>
  dnsLookup(hostname, { all: true });

export interface FetchSafeUrlHtmlOptions {
  lookupFn?: DnsLookupFn;
  fetchFn?: typeof fetch;
}

export type ExtractedUrlRecipe =
  | {
      mode: "json-ld";
      title: string;
      ingredients: string[];
      instructions: string;
      notesText: string | null;
      prepTime: string | null;
      cookTime: string | null;
      totalTime: string | null;
      thumbnailUrl: string | null;
      youtubeUrl: string | null;
      category: string | null;
      area: string | null;
      siteName: string;
      sourceUrl: string;
    }
  | {
      mode: "page-text";
      title: string;
      textSnippet: string;
      youtubeUrl: string | null;
      siteName: string;
      sourceUrl: string;
    };

export async function assertSafeRecipeUrl(
  rawUrl: string,
  lookupFn: DnsLookupFn = defaultDnsLookup,
): Promise<URL> {
  // 1. Parse URL format
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL format.");
  }

  // 2. Protocol check (http and https only)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  // 3. Clean hostname (strip brackets from IPv6 like "[::1]")
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // 4. Reject local/internal hostname aliases
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Requests to local or private addresses are refused.");
  }

  // 5. If hostname is already a raw IP literal, check it directly
  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error(
        "Requests to private or reserved IP addresses are refused.",
      );
    }
    return url;
  }

  // 6. Otherwise, resolve DNS records and verify all returned IPs are public
  const records = await lookupFn(hostname);
  if (
    records.length === 0 ||
    records.some((r) => isPrivateOrReservedIp(r.address))
  ) {
    throw new Error(
      "Domain resolves to a private, local, or reserved IP address.",
    );
  }

  return url;
}

export async function fetchSafeUrlHtml(
  rawUrl: string,
  options: FetchSafeUrlHtmlOptions = {},
): Promise<{ html: string; finalUrl: string }> {
  const { lookupFn = defaultDnsLookup, fetchFn = fetch } = options;
  let currentUrl = await assertSafeRecipeUrl(rawUrl, lookupFn);
  let hops = 0;
  const maxHops = 3;

  while (hops <= maxHops) {
    const res = await fetchFn(currentUrl.href, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BeginnerCookingCompanion/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirect from ${currentUrl.href} has no Location header.`,
        );
      }
      hops++;
      if (hops > maxHops) {
        throw new Error("Too many redirects (max 3).");
      }
      const nextUrl = new URL(location, currentUrl).href;
      currentUrl = await assertSafeRecipeUrl(nextUrl, lookupFn);
      continue;
    }

    if (!res.ok) {
      throw new Error(
        `Failed to fetch page: HTTP ${res.status} ${res.statusText}`,
      );
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(
        `URL did not return an HTML document (content-type: ${contentType}).`,
      );
    }

    const fullText = await res.text();
    const html = fullText.slice(0, 2 * 1024 * 1024);

    return {
      html,
      finalUrl: currentUrl.href,
    };
  }

  throw new Error("Too many redirects (max 3).");
}

export function extractUrlRecipe(
  html: string,
  pageUrl: string,
): ExtractedUrlRecipe {
  const siteName = getSiteNameFromUrl(pageUrl);
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;

    try {
      const parsed = JSON.parse(rawJson);
      const recipeNode = findRecipeNodeInJsonLd(parsed);
      if (!recipeNode) continue;

      const title =
        extractFirstString(recipeNode.name) ||
        extractPageTitle(html) ||
        "Imported Recipe";

      const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
        ? recipeNode.recipeIngredient
        : Array.isArray(recipeNode.ingredients)
          ? recipeNode.ingredients
          : [];

      const ingredients = rawIngredients
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .map((item) => decodeHtmlEntities(item.trim()));

      const instructions = extractInstructionsText(
        recipeNode.recipeInstructions,
      );

      if (ingredients.length > 0 && instructions.length > 0) {
        return {
          mode: "json-ld",
          title,
          ingredients,
          instructions,
          notesText: extractRecipeNotesFromHtml(html),
          prepTime: formatIsoDuration(recipeNode.prepTime),
          cookTime: formatIsoDuration(recipeNode.cookTime),
          totalTime: formatIsoDuration(recipeNode.totalTime),
          thumbnailUrl: extractImageUrl(recipeNode.image, pageUrl),
          youtubeUrl:
            extractYouTubeFromJsonLd(recipeNode.video, pageUrl) ??
            extractYouTubeUrlFromHtml(html, pageUrl),
          category: extractFirstString(recipeNode.recipeCategory),
          area: extractFirstString(recipeNode.recipeCuisine),
          siteName,
          sourceUrl: pageUrl,
        };
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue checking others
    }
  }

  // Fallback: strip non-content blocks and HTML tags to produce clean page text
  const title = extractPageTitle(html) || "Imported Web Page";
  const cleanedText = decodeHtmlEntities(
    stripNonContentBlocks(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, 15000);

  return {
    mode: "page-text",
    title,
    textSnippet: cleanedText,
    youtubeUrl: extractYouTubeUrlFromHtml(html, pageUrl),
    siteName,
    sourceUrl: pageUrl,
  };
}

export function isTransientFetchFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError" || error.name === "AbortError") return true;
  if (error.name === "TypeError") return true;

  const msg = error.message;
  return (
    /timeout|timed out|aborted|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(
      msg,
    ) || /^Failed to fetch page: HTTP 5\d\d\b/.test(msg)
  );
}

export function formatFetchErrorMessage(error: unknown, rawUrl: string): string {
  const isTimeout =
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      /timeout|timed out|aborted/i.test(error.message));

  if (isTimeout) {
    let host = rawUrl;
    try {
      host = new URL(rawUrl).hostname.replace(/^www\./i, "") || rawUrl;
    } catch {
      // keep rawUrl fallback
    }
    return `Timed out waiting for ${host} to respond. You can open the page directly or try another link.`;
  }

  return error instanceof Error ? error.message : "Could not fetch that URL.";
}

// ============================================================================
// SSRF & HTML/JSON-LD Extraction Helpers
// ============================================================================

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const cleaned = rawIp
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  // 1. Unwrap IPv4-mapped IPv6 addresses like "::ffff:127.0.0.1"
  if (cleaned.startsWith("::ffff:")) {
    const mappedV4 = cleaned.slice("::ffff:".length);
    if (isIP(mappedV4) === 4) {
      return isPrivateOrReservedIp(mappedV4);
    }
  }

  const version = isIP(cleaned);

  // 2. IPv4 ranges
  if (version === 4) {
    const [a, b] = cleaned.split(".").map(Number);

    if (a === 0) return true; // 0.0.0.0/8 (unspecified)
    if (a === 10) return true; // 10.0.0.0/8 (private)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (private)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (private)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)
    if (a >= 224) return true; // 224.0.0.0+ (multicast & reserved)

    return false;
  }

  // 3. IPv6 ranges
  if (version === 6) {
    if (cleaned === "::1" || cleaned === "::") return true; // loopback / unspecified
    if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true; // unique local (fc00::/7)
    if (/^fe[89ab]/.test(cleaned)) return true; // link-local (fe80::/10)
    if (cleaned.startsWith("ff")) return true; // multicast (ff00::/8)

    return false;
  }

  return true; // Not a valid IP
}

function formatIsoDuration(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const trimmed = iso.trim();
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
    trimmed,
  );
  if (!match) return trimmed || null;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0) + days * 24;
  const minutes = Number(match[3] || 0);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);

  return parts.length > 0 ? parts.join(" ") : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8216;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&mdash;|&#8212;/g, " - ")
    .replace(/&nbsp;/g, " ")
    .replace(/&frac12;|&#189;/g, "1/2")
    .replace(/&frac14;|&#188;/g, "1/4")
    .replace(/&frac34;|&#190;/g, "3/4");
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const typeVal = node["@type"];
  if (typeof typeVal === "string") {
    return (
      typeVal.toLowerCase() === "recipe" ||
      typeVal.toLowerCase().endsWith("/recipe")
    );
  }
  if (Array.isArray(typeVal)) {
    return typeVal.some(
      (t) =>
        typeof t === "string" &&
        (t.toLowerCase() === "recipe" || t.toLowerCase().endsWith("/recipe")),
    );
  }
  return false;
}

function findRecipeNodeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNodeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const record = data as Record<string, unknown>;
  if (isRecipeNode(record)) {
    return record;
  }

  if (Array.isArray(record["@graph"])) {
    const found = findRecipeNodeInJsonLd(record["@graph"]);
    if (found) return found;
  }

  return null;
}

function extractInstructionsText(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return decodeHtmlEntities(raw.trim());

  if (Array.isArray(raw)) {
    return raw
      .map((item) => extractInstructionsText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.text === "string") {
      return decodeHtmlEntities(obj.text.trim());
    }
    if (typeof obj.name === "string" && !obj.itemListElement) {
      return decodeHtmlEntities(obj.name.trim());
    }
    if (Array.isArray(obj.itemListElement)) {
      return extractInstructionsText(obj.itemListElement);
    }
  }

  return "";
}

function extractImageUrl(raw: unknown, pageUrl: string): string | null {
  let candidate: string | null = null;
  if (typeof raw === "string") {
    candidate = raw.trim();
  } else if (Array.isArray(raw) && raw.length > 0) {
    return extractImageUrl(raw[0], pageUrl);
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.url === "string") candidate = obj.url.trim();
  }

  if (!candidate) return null;
  try {
    return new URL(candidate, pageUrl).href;
  } catch {
    return null;
  }
}

function extractFirstString(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    return decodeHtmlEntities(raw.trim());
  }
  if (Array.isArray(raw) && raw.length > 0) return extractFirstString(raw[0]);
  return null;
}

function getSiteNameFromUrl(pageUrl: string): string {
  try {
    const hostname = new URL(pageUrl).hostname.replace(/^www\./i, "");
    return hostname || "Web Recipe";
  } catch {
    return "Web Recipe";
  }
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts a canonical `https://www.youtube.com/watch?v=...` URL from YouTube
 * watch, embed, shorts, or `youtu.be` links, ignoring channel/subscribe URLs.
 */
function normalizeYouTubeVideoUrl(
  rawUrl: string,
  baseUrl?: string,
): string | null {
  try {
    const decoded = decodeHtmlEntities(rawUrl.trim());
    const parsed = new URL(decoded, baseUrl || "https://www.youtube.com");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    let videoId: string | null = null;

    if (host === "youtu.be" && segments[0]) {
      videoId = segments[0];
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (segments[0] === "watch") {
        videoId = parsed.searchParams.get("v");
      } else if (
        segments[0] &&
        ["embed", "shorts", "live", "v"].includes(segments[0]) &&
        segments[1]
      ) {
        videoId = segments[1];
      }
    }

    return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)
      ? `https://www.youtube.com/watch?v=${videoId}`
      : null;
  } catch {
    return null;
  }
}

function extractYouTubeFromJsonLd(raw: unknown, pageUrl: string): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return normalizeYouTubeVideoUrl(raw, pageUrl);
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = extractYouTubeFromJsonLd(item, pageUrl);
      if (found) return found;
    }
    return null;
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["embedUrl", "contentUrl", "url", "@id"]) {
      if (typeof obj[key] === "string") {
        const found = normalizeYouTubeVideoUrl(obj[key], pageUrl);
        if (found) return found;
      }
    }
  }
  return null;
}

function extractYouTubeUrlFromHtml(
  html: string,
  pageUrl: string,
): string | null {
  const cleanHtml = stripNonContentBlocks(html);

  // Prefer embedded video players first, then direct watch/share links in body content
  const embedSrcRegex =
    /(?:data-src|src)=["']([^"']*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)[^"']*)["']/gi;
  for (const match of cleanHtml.matchAll(embedSrcRegex)) {
    const found = normalizeYouTubeVideoUrl(match[1], pageUrl);
    if (found) return found;
  }

  const hrefRegex =
    /href=["']([^"']*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)[^"']*)["']/gi;
  for (const match of cleanHtml.matchAll(hrefRegex)) {
    const found = normalizeYouTubeVideoUrl(match[1], pageUrl);
    if (found) return found;
  }

  return null;
}

function extractPageTitle(html: string): string | null {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!titleMatch?.[1]) return null;
  return decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim());
}

function stripNonContentBlocks(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
}

function extractBalancedInnerHtml(
  html: string,
  tagName: string,
  contentStartIndex: number,
): string {
  const tagRegex = new RegExp(`<(\\/?)${tagName}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = contentStartIndex;

  let depth = 1;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    if (tagMatch[1] === "/") {
      depth--;
      if (depth === 0) {
        return html.slice(contentStartIndex, tagMatch.index);
      }
    } else {
      depth++;
    }
  }

  return html.slice(contentStartIndex, contentStartIndex + 15000);
}

function htmlBlockToCleanText(blockHtml: string): string | null {
  const withBreaks = blockHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n");
  const stripped = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "));
  const lines = stripped
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(?:recipe\s+notes|cook'?s\s+notes|chef'?s\s+notes|notes)\s*:?$/i.test(
          line,
        ),
    );

  const joined = lines.join("\n").slice(0, 12000).trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Extracts recipe notes from HTML across common recipe card plugins
 * (WP Recipe Maker, Tasty Recipes, Mediavine Create) and generic sites.
 */
export function extractRecipeNotesFromHtml(html: string): string | null {
  const cleanHtml = stripNonContentBlocks(html);

  const containerRegex =
    /<(div|section|aside|article|ul|ol)\b[^>]*(?:class|id)=["'][^"']*(?:wprm-recipe-notes|tasty-recipes-notes|mv-create-notes|easyrecipe-notes|recipe[-_]notes|cooks-notes|chefs-notes)[^"']*["'][^>]*>/gi;

  let containerMatch: RegExpExecArray | null;
  while ((containerMatch = containerRegex.exec(cleanHtml)) !== null) {
    const tagName = containerMatch[1];
    const startIndex = containerMatch.index + containerMatch[0].length;
    const innerHtml = extractBalancedInnerHtml(cleanHtml, tagName, startIndex);
    const cleaned = htmlBlockToCleanText(innerHtml);
    if (cleaned) return cleaned;
  }

  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const headingText = decodeHtmlEntities(
      headingMatch[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (
      !/^(?:recipe\s+notes|cook'?s\s+notes|chef'?s\s+notes|notes)\s*:?$/i.test(
        headingText,
      )
    ) {
      continue;
    }

    const afterHeading = cleanHtml.slice(
      headingMatch.index + headingMatch[0].length,
    );
    const endMatch = /<h[1-6]\b|<\/(?:section|article)\b/i.exec(afterHeading);
    const sectionHtml = endMatch
      ? afterHeading.slice(0, endMatch.index)
      : afterHeading.slice(0, 15000);
    const cleaned = htmlBlockToCleanText(sectionHtml);
    if (cleaned) return cleaned;
  }

  return null;
}
