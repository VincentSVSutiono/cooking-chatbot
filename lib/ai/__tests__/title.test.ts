import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateChatTitleSummary } from "@/lib/ai/title";

describe("generateChatTitleSummary", () => {
  it("returns a trimmed title with surrounding quotes and trailing punctuation stripped", async () => {
    let capturedPrompt = "";
    const result = await generateChatTitleSummary(
      "Can you show me how to make crispy carbonara from scratch?",
      {
        generateTextFn: async (prompt) => {
          capturedPrompt = prompt;
          return '  "Crispy Spaghetti Carbonara."  ';
        },
      },
    );

    expect(capturedPrompt).toContain("crispy carbonara");
    expect(result).toBe("Crispy Spaghetti Carbonara");
  });

  it("returns null without calling the model when firstUserText is blank", async () => {
    const generateTextFn = vi.fn(async () => "Should Not Run");

    expect(await generateChatTitleSummary("", { generateTextFn })).toBeNull();
    expect(
      await generateChatTitleSummary("   \n\t  ", { generateTextFn }),
    ).toBeNull();
    expect(generateTextFn).not.toHaveBeenCalled();
  });

  it("returns null when the model returns empty or quote-only output", async () => {
    const result = await generateChatTitleSummary("How do I boil eggs?", {
      generateTextFn: async () => '  ""  ',
    });

    expect(result).toBeNull();
  });

  it("returns null without throwing when the model rejects (e.g. 429 rate limit)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await generateChatTitleSummary("Best beef rendang recipe", {
      generateTextFn: async () => {
        throw new Error("429 RESOURCE_EXHAUSTED");
      },
    });

    expect(result).toBeNull();
    errorSpy.mockRestore();
  });
});
