"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { AVAILABLE_MODELS, type ModelId } from "@/config/models";

interface ModelSelectorProps {
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  disabled?: boolean;
}

export default function ModelSelector({
  selectedModel,
  onSelectModel,
  disabled = false,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(model: ModelId) {
    onSelectModel(model);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select AI model, currently ${selectedModel}`}
        className="inline-flex h-8 max-w-[170px] sm:max-w-[210px] items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selectedModel}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Desktop / Tablet Floating Popover Menu (>=640px) */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available models"
          className="absolute bottom-full left-0 mb-2 z-40 hidden sm:block w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
        >
          <div className="space-y-0.5">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model === selectedModel;
              return (
                <button
                  key={model}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(model)}
                  className={`flex min-h-9 w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-user-message/70 text-text font-semibold"
                      : "text-text hover:bg-user-message/40"
                  }`}
                >
                  <span className="truncate">{model}</span>
                  {isSelected && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-accent-strong ml-2"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Slide-Up Bottom Sheet (<640px) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Darkened backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom sheet panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-sheet-title"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface px-4 pt-3 pb-6 shadow-2xl"
          >
            {/* Header with Title and Close X */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2
                id="model-sheet-title"
                className="font-serif text-base font-semibold text-text"
              >
                Select model
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close model selection"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Model List with >=44px tap targets */}
            <div
              role="listbox"
              aria-label="Available models"
              className="mt-3 flex flex-col gap-2"
            >
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = model === selectedModel;
                return (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(model)}
                    className={`flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-accent-strong bg-user-message/70 text-text font-semibold"
                        : "border-border/60 bg-background text-text hover:bg-user-message/40"
                    }`}
                  >
                    <span className="truncate">{model}</span>
                    {isSelected && (
                      <Check
                        className="h-4 w-4 shrink-0 text-accent-strong ml-2"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
