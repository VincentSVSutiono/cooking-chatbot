import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  streamText,
  type UIMessage,
} from "ai";
import { getChatModel, COOKING_SYSTEM_PROMPT } from "@/config/ai";

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: UIMessage[] = body?.messages;
    const requestedModel: string | undefined = body?.model;

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Expected a messages array." },
        { status: 400 },
      );
    }

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: getChatModel(requestedModel),
      instructions: COOKING_SYSTEM_PROMPT,
      messages: modelMessages,
    });

    const uiStream = toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error("Chat stream error:", error);
        if (isQuotaError(error)) {
          return "QUOTA_EXCEEDED: This model has reached its rate limit or daily quota. Please switch to another model using the selector below, then click Try again.";
        }
        return "Couldn't reach the cooking assistant. Please try again.";
      },
    });

    return createUIMessageStreamResponse({
      stream: uiStream,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    if (isQuotaError(error)) {
      return Response.json(
        {
          error:
            "QUOTA_EXCEEDED: This model has reached its rate limit or daily quota. Please switch to another model using the selector below, then click Try again.",
        },
        { status: 429 },
      );
    }
    return Response.json(
      { error: "Failed to process chat request." },
      { status: 500 },
    );
  }
}
