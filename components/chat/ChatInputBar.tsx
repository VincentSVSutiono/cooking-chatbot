"use client";

import {
  useState,
  useRef,
  type SubmitEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import type { FileUIPart } from "ai";
import {
  Send,
  Square,
  Paperclip,
  X,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import ModelSelector from "./ModelSelector";
import type { ModelId } from "@/config/models";
import {
  ACCEPTED_FILE_INPUT,
  MAX_ATTACHMENTS_PER_MESSAGE,
  prepareFilesForChat,
} from "@/lib/files/attachments";
import { useAutogrowTextarea } from "@/hooks/useAutogrowTextarea";
import { useVisualViewport } from "@/hooks/useVisualViewport";

interface ChatInputBarProps {
  onSendMessage: (payload: { text?: string; files?: FileUIPart[] }) => void;
  onStop: () => void;
  isBusy: boolean;
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
}

export default function ChatInputBar({
  onSendMessage,
  onStop,
  isBusy,
  selectedModel,
  onSelectModel,
}: ChatInputBarProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleFocus, handleBlur } = useVisualViewport();
  useAutogrowTextarea(textareaRef, input);

  const atAttachmentLimit = attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE;
  const canSubmit =
    (input.trim().length > 0 || attachments.length > 0) && !isPreparingFiles;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setAttachmentError(null);
    setIsPreparingFiles(true);
    try {
      const { files, error } = await prepareFilesForChat(
        fileList,
        attachments.length,
      );
      if (error) {
        setAttachmentError(error);
        return;
      }
      if (files.length > 0) {
        setAttachments((prev) => [...prev, ...files]);
      }
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not read attached file.",
      );
    } finally {
      setIsPreparingFiles(false);
      // Reset so selecting the same file again still fires onChange
      e.target.value = "";
    }
  }

  function handleRemoveAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  }

  function submitMessage(e?: SubmitEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isBusy || isPreparingFiles) {
      return;
    }

    onSendMessage({
      text: trimmed || undefined,
      files: attachments.length > 0 ? attachments : undefined,
    });

    setInput("");
    setAttachments([]);
    setAttachmentError(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // On touchscreens / mobile keyboards, Enter creates a newline; users tap Send.
    const isTouchDevice =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !isTouchDevice &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      submitMessage();
    }
  }

  return (
    <footer className="w-full shrink-0 bg-background px-3 pt-1 pb-2 sm:px-4 sm:pb-3 md:px-5">
      <form
        onSubmit={submitMessage}
        className="mx-auto flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface p-2.5 sm:p-3 shadow-xs transition-colors focus-within:border-accent-strong"
      >
        {/* Pending Attachment Previews */}
        {attachments.length > 0 && (
          <div
            aria-label="Attached files"
            className="flex flex-wrap gap-2.5 px-1 pt-0.5 pb-2.5"
          >
            {attachments.map((file, index) => {
              const isImage = file.mediaType?.startsWith("image/");
              const label = file.filename || `Attachment ${index + 1}`;
              return (
                <div
                  key={`${label}-${index}`}
                  className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-background p-2 sm:p-2 text-xs text-text"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={label}
                      className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-accent-strong">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="max-w-[140px] sm:max-w-[190px] truncate font-medium">
                        {label}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index)}
                    disabled={isBusy}
                    aria-label={`Remove ${label}`}
                    className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-user-message hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline Attachment Validation Error */}
        {attachmentError && (
          <p
            role="alert"
            className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-warning"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{attachmentError}</span>
          </p>
        )}

        <label htmlFor="chat-input" className="sr-only">
          Ask a cooking question
        </label>
        <textarea
          ref={textareaRef}
          id="chat-input"
          rows={1}
          autoComplete="off"
          autoCorrect="off"
          value={input}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a cooking question, paste a recipe link, or attach a photo…"
          className="w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-text placeholder:text-text-muted focus:outline-none min-h-[28px] max-h-32 sm:max-h-36 md:max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_INPUT}
          onChange={handleFileChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Bottom Toolbar Row - Attachment & Model selector on left, Send/Stop button on right */}
        <div className="flex shrink-0 items-center justify-between gap-2 pt-1.5 sm:pt-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy || isPreparingFiles || atAttachmentLimit}
              aria-label={
                atAttachmentLimit
                  ? `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} files attached`
                  : "Attach photo or recipe file"
              }
              title={
                atAttachmentLimit
                  ? `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} files per message`
                  : "Attach photo, PDF, or text recipe"
              }
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-user-message hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPreparingFiles ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-accent-strong"
                  aria-hidden="true"
                />
              ) : (
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              disabled={isBusy}
            />
          </div>

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating response"
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-accent-strong transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Send message"
              className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </footer>
  );
}
