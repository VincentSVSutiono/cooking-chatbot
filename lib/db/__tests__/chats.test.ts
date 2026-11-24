import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ChatMessage } from "@/lib/ai/tools";
import {
  isValidUuid,
  parseValidChatId,
  extractMessageText,
  extractFallbackChatTitle,
  toMessageDB,
  toChatMessage,
} from "@/lib/db/chats";

describe("isValidUuid", () => {
  it("returns true for valid v4 UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isValidUuid("A3BB189E-8BF9-4888-9912-ACE4E6543002")).toBe(true);
  });

  it("returns false for non-UUID strings and path traversal inputs", () => {
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("123")).toBe(false);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("../etc/passwd")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000/../admin")).toBe(
      false,
    );
  });
});

describe("parseValidChatId", () => {
  it("returns the chat ID string when given a valid v4 UUID", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseValidChatId(id)).toBe(id);
  });

  it("returns null for non-strings or invalid UUID values", () => {
    expect(parseValidChatId(undefined)).toBeNull();
    expect(parseValidChatId(null)).toBeNull();
    expect(parseValidChatId(12345)).toBeNull();
    expect(parseValidChatId({})).toBeNull();
    expect(parseValidChatId("not-a-uuid")).toBeNull();
  });
});

describe("extractMessageText", () => {
  it("joins and normalizes whitespace across text parts", () => {
    const text = extractMessageText({
      parts: [
        { type: "text", text: "  How do I   simmer\n" },
        {
          type: "file",
          mediaType: "image/jpeg",
          filename: "pot.jpg",
          url: "data:image/jpeg;base64,abc",
        },
        { type: "text", text: "  tomato sauce?  " },
      ],
    });

    expect(text).toBe("How do I simmer tomato sauce?");
  });

  it("returns an empty string for undefined or file-only messages", () => {
    expect(extractMessageText(undefined)).toBe("");
    expect(
      extractMessageText({
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            filename: "fridge.png",
            url: "data:image/png;base64,abc",
          },
        ],
      }),
    ).toBe("");
  });
});

describe("extractFallbackChatTitle", () => {
  it("extracts a clean title from normal cooking questions", () => {
    const title = extractFallbackChatTitle({
      parts: [{ type: "text", text: "How do I make crispy carbonara?" }],
    });

    expect(title).toBe("How do I make crispy carbonara?");
  });

  it("strips common conversational filler prefixes", () => {
    const title = extractFallbackChatTitle({
      parts: [
        { type: "text", text: "Can you show me how to make beef rendang" },
      ],
    });

    expect(title).toBe("Beef rendang");
  });

  it("cleans URL messages so raw https:// is not shown", () => {
    const title = extractFallbackChatTitle({
      parts: [
        {
          type: "text",
          text: "Import the recipe from https://www.seriouseats.com/best-chili-recipe",
        },
      ],
    });

    expect(title).not.toContain("https://");
    expect(title).not.toContain("http://");
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(50);
  });

  it("truncates messages over 50 chars cleanly with ellipsis", () => {
    const title = extractFallbackChatTitle({
      parts: [
        {
          type: "text",
          text: "Slow braised short ribs with caramelized onions, rosemary, and red wine reduction",
        },
      ],
    });

    expect(title.length).toBeLessThanOrEqual(50);
    expect(title.endsWith("...")).toBe(true);
  });

  it("returns Photo / Recipe Upload when parts only contains file attachments", () => {
    const title = extractFallbackChatTitle({
      parts: [
        {
          type: "file",
          mediaType: "image/jpeg",
          filename: "fridge.jpg",
          url: "data:image/jpeg;base64,abc123",
        },
      ],
    });

    expect(title).toBe("Photo / Recipe Upload");
  });
});

describe("toMessageDB and toChatMessage", () => {
  it("round-trips a ChatMessage with text, tool parts, and file parts", () => {
    const chatId = "550e8400-e29b-41d4-a716-446655440000";
    const createdAt = "2026-11-24T10:00:00.000Z";
    const message: ChatMessage = {
      id: "msg_abc123",
      role: "assistant",
      parts: [
        { type: "text", text: "Here are some carbonara matches." },
        {
          type: "tool-searchRecipes",
          toolCallId: "call_1",
          state: "output-available",
          input: { query: "carbonara" },
          output: {
            query: "carbonara",
            found: true,
            totalMatches: 1,
            offset: 0,
            recipes: [
              {
                id: "52982",
                title: "Spaghetti alla Carbonara",
                category: "Pasta",
                area: "Italian",
                instructions: "Boil pasta...",
                ingredients: [{ item: "Spaghetti", amount: "400g" }],
                thumbnailUrl: "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg",
                sourceUrl: "https://www.themealdb.com/meal/52982",
                youtubeUrl: null,
              },
            ],
          },
        },
        {
          type: "file",
          mediaType: "image/png",
          filename: "ingredients.png",
          url: "data:image/png;base64,iVBORw0KGgo=",
        },
      ],
    };

    const dbMessage = toMessageDB(chatId, message, createdAt);
    expect(dbMessage).toEqual({
      id: "msg_abc123",
      chat_id: chatId,
      role: "assistant",
      parts: message.parts,
      created_at: createdAt,
    });

    const restored = toChatMessage(dbMessage);
    expect(restored).toEqual(message);
  });

  it("assigns a valid ISO timestamp when createdAtIso is omitted", () => {
    const message: ChatMessage = {
      id: "msg_user_1",
      role: "user",
      parts: [{ type: "text", text: "What does simmer mean?" }],
    };

    const dbMessage = toMessageDB("550e8400-e29b-41d4-a716-446655440000", message);
    expect(Number.isNaN(Date.parse(dbMessage.created_at))).toBe(false);
    expect(toChatMessage(dbMessage)).toEqual(message);
  });
});
