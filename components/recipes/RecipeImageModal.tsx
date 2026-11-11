"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";

export interface RecipeImageModalProps {
  src: string;
  alt: string;
  dishName: string;
  sourceName?: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function RecipeImageModal({
  src,
  alt,
  dishName,
  sourceName,
  width = 112,
  height = 112,
  className = "",
}: RecipeImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isTheMealDb = src.includes("www.themealdb.com");
  const resolvedSourceName = sourceName || (isTheMealDb ? "TheMealDB" : undefined);

  return (
    <>
      {/* Clickable thumbnail with zoom hint */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`View full photo for ${dishName}`}
        title="Click to expand photo"
        className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${className}`}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          unoptimized={!isTheMealDb}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-text/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-accent-strong shadow-xs">
            <ZoomIn className="h-4 w-4" />
          </div>
        </div>
      </button>

      {/* Full photo modal dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full photo preview for ${dishName}`}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/75 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <h4 className="font-serif text-base sm:text-lg font-semibold text-text truncate">
                {dishName}
              </h4>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close photo preview"
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-background/50 p-2 sm:p-4">
              <Image
                src={src}
                alt={alt}
                width={800}
                height={600}
                unoptimized={!isTheMealDb}
                className="max-h-[72dvh] w-auto max-w-full rounded-xl border border-border object-contain shadow-sm"
              />
            </div>

            {/* Modal Footer Caption - shown dynamically when source is known */}
            {resolvedSourceName && (
              <div className="border-t border-border bg-surface px-4 py-2.5 text-center text-xs text-text-muted">
                <span>Photo from {resolvedSourceName}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
