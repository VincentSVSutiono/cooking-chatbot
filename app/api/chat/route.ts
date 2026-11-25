import { after } from "next/server";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  toUIMessageStream,
  streamText,
  isStepCount,
} from "ai";
import { getChatModel, COOKING_SYSTEM_PROMPT } from "@/config/ai";
import { createCookingTools, type ChatMessage } from "@/lib/ai/tools";
import { parseValidChatId } from "@/lib/db/chats";
import { startSaveChat } from "@/lib/db/save-chat";
import { validateMessageAttachments } from "@/lib/files/attachments";

const QUOTA_ERROR_MESSAGE =
  "QUOTA_EXCEEDED: This model has reached its rate limit or daily quota. Please switch to another model using the selector below, then click Try again.";
const OVERLOADED_ERROR_MESSAGE =
  "MODEL_OVERLOADED: This model is currently experiencing high demand. Please switch to another model using the selector below or click Try again in a moment.";

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

function isHighDemandError(error: unknown): boolean {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return (
    statusCode === 503 ||
    message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand") ||
    message.toLowerCase().includes("overloaded")
  );
}

function classifyChatError(error: unknown): {
  status: 429 | 503 | 500;
  clientMessage: string | null;
} {
  if (isQuotaError(error)) {
    return { status: 429, clientMessage: QUOTA_ERROR_MESSAGE };
  }
  if (isHighDemandError(error)) {
    return { status: 503, clientMessage: OVERLOADED_ERROR_MESSAGE };
  }
  return { status: 500, clientMessage: null };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body?.messages;
    const requestedModel: string | undefined = body?.model;
    const chatId = parseValidChatId(body?.chatId ?? body?.id);

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Expected a non-empty messages array." },
        { status: 400 },
      );
    }

    const attachmentError = validateMessageAttachments(messages);
    if (attachmentError) {
      return Response.json({ error: attachmentError }, { status: 422 });
    }

    const savedChat = await startSaveChat(chatId, messages);
    const backgroundTask = savedChat?.backgroundTask;
    if (backgroundTask) {
      after(() => backgroundTask);
    }

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: getChatModel(requestedModel),
      instructions: COOKING_SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: isStepCount(3),
      tools: createCookingTools(requestedModel),
      onToolExecutionStart: ({ toolCall }) => {
        console.log(
          `[Tool Start] ${toolCall.toolName} with input:`,
          toolCall.input,
        );
      },
      onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
        const out =
          toolOutput.type === "tool-result" &&
          toolOutput.output &&
          typeof toolOutput.output === "object"
            ? (toolOutput.output as Record<string, unknown>)
            : null;
        const summary =
          out && "totalMatches" in out
            ? `matches: ${out.totalMatches}`
            : out && "status" in out
              ? `status: ${out.status}`
              : "done";
        console.log(
          `[Tool End] ${toolCall.toolName} in ${toolExecutionMs}ms (${summary})`,
        );
      },
    });

    result.consumeStream();

    const uiStream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: savedChat?.onStreamEnd,
      onError: (error) => {
        console.error("Chat stream error:", error);
        return (
          classifyChatError(error).clientMessage ??
          "Couldn't reach the cooking assistant. Please try again."
        );
      },
    });

    return createUIMessageStreamResponse({
      stream: uiStream,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    const { status, clientMessage } = classifyChatError(error);
    return Response.json(
      { error: clientMessage ?? "Failed to process chat request." },
      { status },
    );
  }
}
