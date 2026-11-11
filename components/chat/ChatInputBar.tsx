import { type RefObject, type FormEvent, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import ModelSelector from "./ModelSelector";
import type { ModelId } from "@/config/models";

export interface ChatInputBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isBusy: boolean;
  onStop: () => void;
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatInputBar({
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  onFocus,
  onBlur,
  isBusy,
  onStop,
  selectedModel,
  onSelectModel,
  textareaRef,
}: ChatInputBarProps) {
  return (
    <footer className="w-full shrink-0 bg-background px-3 pt-1 pb-2 sm:px-4 sm:pb-3 md:px-5">
      <form
        onSubmit={onSubmit}
        className="mx-auto flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface p-2.5 sm:p-3 shadow-xs transition-colors focus-within:border-accent-strong"
      >
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
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a cooking related question..."
          className="w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-text placeholder:text-text-muted focus:outline-none min-h-[28px] max-h-32 sm:max-h-36 md:max-h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        {/* Bottom Toolbar Row - Model selector on left, Send/Stop button on right */}
        <div className="flex shrink-0 items-center justify-between pt-1.5 sm:pt-2">
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            disabled={isBusy}
          />

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating response"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-accent-strong transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </footer>
  );
}
