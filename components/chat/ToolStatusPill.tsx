import {
  Loader2,
  Search,
  AlertCircle,
  ChefHat,
  Link2,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { CookingToolPart } from "@/lib/ai/tools";

interface ToolStatusPillProps {
  part: CookingToolPart;
}

interface PillResolution {
  isError: boolean;
  label: string;
  SuccessIcon: LucideIcon;
}

function getHostnameLabel(rawUrl?: string): string {
  if (!rawUrl) return "link";
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "") || "link";
  } catch {
    return "link";
  }
}

function resolveToolPill(
  part: CookingToolPart,
  isLoading: boolean,
  isStreamError: boolean,
): PillResolution {
  switch (part.type) {
    case "tool-searchRecipes": {
      const output = part.state === "output-available" ? part.output : undefined;
      const query = output?.query || part.input?.query || "";

      if (isLoading) {
        return {
          isError: false,
          label: query
            ? `Searching recipes for "${query}"…`
            : "Searching for recipes…",
          SuccessIcon: Search,
        };
      }
      if (isStreamError) {
        return {
          isError: true,
          label: `Search error for "${query}"`,
          SuccessIcon: Search,
        };
      }
      return {
        isError: false,
        label: output?.found
          ? `Found ${output.totalMatches} recipe${output.totalMatches === 1 ? "" : "s"} for "${query}"`
          : `No recipe match found for "${query}"`,
        SuccessIcon: Search,
      };
    }

    case "tool-getRecipe": {
      const output = part.state === "output-available" ? part.output : undefined;
      const title =
        output?.status === "success"
          ? output.recipe.title
          : output?.title || part.input?.title || part.input?.id || "recipe";

      if (isLoading) {
        return {
          isError: false,
          label: `Formatting recipe card for "${title}"…`,
          SuccessIcon: ChefHat,
        };
      }

      const isError =
        isStreamError ||
        (output !== undefined && output.status !== "success");

      return {
        isError,
        label: isError
          ? `Unable to load recipe card for "${title}"`
          : `Recipe card ready: "${title}"`,
        SuccessIcon: ChefHat,
      };
    }

    case "tool-importUrlRecipe": {
      const output = part.state === "output-available" ? part.output : undefined;
      const host =
        output?.status === "success"
          ? output.recipe.source.name
          : getHostnameLabel(output?.url || part.input?.url);

      if (isLoading) {
        return {
          isError: false,
          label: `Importing recipe from ${host}…`,
          SuccessIcon: Link2,
        };
      }

      const isError =
        isStreamError || (output !== undefined && output.status !== "success");

      return {
        isError,
        label: isError
          ? `Could not import recipe from ${host}`
          : `Imported recipe from ${host}`,
        SuccessIcon: Link2,
      };
    }

    case "tool-webSearch": {
      const output = part.state === "output-available" ? part.output : undefined;
      const query = output?.query || part.input?.query || "";

      if (isLoading) {
        return {
          isError: false,
          label: query
            ? `Searching the web for "${query}"…`
            : "Searching the web…",
          SuccessIcon: Globe,
        };
      }

      const isError =
        isStreamError ||
        output?.status === "error" ||
        output?.status === "unconfigured";

      if (isError) {
        return {
          isError: true,
          label: query
            ? `Web search unavailable for "${query}"`
            : "Web search unavailable",
          SuccessIcon: Globe,
        };
      }

      if (output?.status === "success") {
        const count = output.results.length;
        return {
          isError: false,
          label: `Found ${count} web result${count === 1 ? "" : "s"} for "${query}"`,
          SuccessIcon: Globe,
        };
      }

      return {
        isError: false,
        label: query
          ? `No web results found for "${query}"`
          : "No web results found",
        SuccessIcon: Globe,
      };
    }
  }
}

export default function ToolStatusPill({ part }: ToolStatusPillProps) {
  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";
  const isStreamError = part.state === "output-error";
  const { isError, label, SuccessIcon } = resolveToolPill(
    part,
    isLoading,
    isStreamError,
  );

  return (
    <div className="mb-2.5">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
        {isLoading ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-strong"
            aria-hidden="true"
          />
        ) : isError ? (
          <AlertCircle
            className="h-3.5 w-3.5 shrink-0 text-warning"
            aria-hidden="true"
          />
        ) : (
          <SuccessIcon
            className="h-3.5 w-3.5 shrink-0 text-accent-strong"
            aria-hidden="true"
          />
        )}
        <span className={`truncate ${isError ? "text-warning" : ""}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
