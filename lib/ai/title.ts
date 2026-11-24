import "server-only";
import { generateText } from "ai";
import { getChatModel } from "@/config/ai";

export interface GenerateTitleOptions {
  generateTextFn?: (prompt: string) => Promise<string>;
}

const TITLE_MODEL_ID = "gemini-3.1-flash-lite";
const MAX_INPUT_CHARS = 500;

function cleanGeneratedTitle(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Generates a concise 3-5 word cooking chat title using gemini-3.1-flash-lite.
 * Returns null if the input is empty or if the model throws (e.g. 429 quota),
 * so the caller silently keeps the deterministic fallback title.
 */
export async function generateChatTitleSummary(
  firstUserText: string,
  options?: GenerateTitleOptions,
): Promise<string | null> {
  const trimmedInput = firstUserText.trim();
  if (!trimmedInput) {
    return null;
  }

  const promptInput = trimmedInput.slice(0, MAX_INPUT_CHARS);
  const prompt = [
    "Summarize the user's cooking message into a concise 3 to 5 word chat title.",
    "Return ONLY the title text, with no quotes or trailing punctuation.",
    "",
    `User message: ${promptInput}`,
  ].join("\n");

  try {
    const rawTitle = options?.generateTextFn
      ? await options.generateTextFn(prompt)
      : (
          await generateText({
            model: getChatModel(TITLE_MODEL_ID),
            prompt,
          })
        ).text;

    return cleanGeneratedTitle(rawTitle);
  } catch (error) {
    console.error("Failed to generate chat title summary:", error);
    return null;
  }
}
