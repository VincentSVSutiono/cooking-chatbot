import {
  Loader2,
  Search,
  AlertCircle,
  ChefHat,
  Link2,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { DishSearchResult } from "@/lib/recipes/search";
import type {
  ShowRecipeCardOutput,
  ImportRecipeUrlOutput,
  WebSearchOutput,
} from "@/lib/ai/types";

export interface ToolStatusPillProps {
  state: string;
  toolName?:
    | "searchDishByName"
    | "showRecipeCard"
    | "importRecipeFromUrl"
    | "searchWeb"
    | string;
  input?: unknown;
  output?: unknown;
}

interface PillResolution {
  isError: boolean;
  label: string;
  SuccessIcon: LucideIcon;
}

interface PillContext {
  isLoading: boolean;
  isStreamError: boolean;
  input: unknown;
  output: unknown;
}

type ToolPillResolver = (ctx: PillContext) => PillResolution;

function asRecord<T extends object>(value: unknown): T | undefined {
  return value && typeof value === "object" ? (value as T) : undefined;
}

function getHostnameLabel(rawUrl?: string): string {
  if (!rawUrl) return "link";
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "") || "link";
  } catch {
    return "link";
  }
}

const resolveImportRecipePill: ToolPillResolver = ({
  isLoading,
  isStreamError,
  input,
  output,
}) => {
  const inputObj = asRecord<{ url?: string }>(input);
  const outputObj = asRecord<ImportRecipeUrlOutput>(output);
  const host =
    outputObj?.status === "success"
      ? outputObj.recipe.source.name
      : getHostnameLabel(outputObj?.url || inputObj?.url);

  if (isLoading) {
    return { isError: false, label: `Importing recipe from ${host}…`, SuccessIcon: Link2 };
  }

  const isError =
    isStreamError || (outputObj !== undefined && outputObj.status !== "success");
  return {
    isError,
    label: isError
      ? `Could not import recipe from ${host}`
      : `Imported recipe from ${host}`,
    SuccessIcon: Link2,
  };
};

const resolveWebSearchPill: ToolPillResolver = ({
  isLoading,
  isStreamError,
  input,
  output,
}) => {
  const inputObj = asRecord<{ query?: string }>(input);
  const outputObj = asRecord<WebSearchOutput>(output);
  const query = outputObj?.query || inputObj?.query || "";

  if (isLoading) {
    return {
      isError: false,
      label: query ? `Searching the web for "${query}"…` : "Searching the web…",
      SuccessIcon: Globe,
    };
  }

  const isError =
    isStreamError ||
    outputObj?.status === "error" ||
    outputObj?.status === "unconfigured";
  if (isError) {
    return {
      isError: true,
      label: query ? `Web search unavailable for "${query}"` : "Web search unavailable",
      SuccessIcon: Globe,
    };
  }

  if (outputObj?.status === "success") {
    const count = outputObj.results.length;
    return {
      isError: false,
      label: `Found ${count} web result${count === 1 ? "" : "s"} for "${query}"`,
      SuccessIcon: Globe,
    };
  }

  return {
    isError: false,
    label: query ? `No web results found for "${query}"` : "No web results found",
    SuccessIcon: Globe,
  };
};

const resolveShowRecipePill: ToolPillResolver = ({
  isLoading,
  isStreamError,
  input,
  output,
}) => {
  const inputObj = asRecord<{ mealId?: string; mealName?: string }>(input);
  const outputObj = asRecord<ShowRecipeCardOutput>(output);
  const dishName =
    outputObj?.status === "success"
      ? outputObj.recipe.title
      : outputObj?.mealName || inputObj?.mealName || inputObj?.mealId || "recipe";

  if (isLoading) {
    return {
      isError: false,
      label: `Formatting recipe card for "${dishName}"…`,
      SuccessIcon: ChefHat,
    };
  }

  const isError =
    isStreamError ||
    outputObj?.status === "validation-error" ||
    outputObj?.status === "not-found";
  return {
    isError,
    label: isError
      ? `Unable to load recipe card for "${dishName}"`
      : `Recipe card ready: "${dishName}"`,
    SuccessIcon: ChefHat,
  };
};

const resolveDishSearchPill: ToolPillResolver = ({
  isLoading,
  isStreamError,
  input,
  output,
}) => {
  const inputObj = asRecord<{ query?: string }>(input);
  const outputObj = asRecord<DishSearchResult>(output);
  const query = outputObj?.query || inputObj?.query || "";

  if (isLoading) {
    return {
      isError: false,
      label: `Searching TheMealDB for "${query || "recipes"}"…`,
      SuccessIcon: Search,
    };
  }

  if (isStreamError) {
    return { isError: true, label: `Search error for "${query}"`, SuccessIcon: Search };
  }

  return {
    isError: false,
    label: outputObj?.found
      ? `Found ${outputObj.totalMatches} recipe${outputObj.totalMatches === 1 ? "" : "s"} for "${query}"`
      : `No recipe match found for "${query}"`,
    SuccessIcon: Search,
  };
};

const TOOL_PILL_RESOLVERS: Record<string, ToolPillResolver> = {
  importRecipeFromUrl: resolveImportRecipePill,
  searchWeb: resolveWebSearchPill,
  showRecipeCard: resolveShowRecipePill,
  searchDishByName: resolveDishSearchPill,
};

export default function ToolStatusPill({
  state,
  toolName = "searchDishByName",
  input,
  output,
}: ToolStatusPillProps) {
  const isLoading = state === "input-streaming" || state === "input-available";
  const isStreamError = state === "output-error";
  const resolver = TOOL_PILL_RESOLVERS[toolName] ?? resolveDishSearchPill;
  const { isError, label, SuccessIcon } = resolver({
    isLoading,
    isStreamError,
    input,
    output,
  });

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
        <span className={`truncate ${isError ? "text-warning" : ""}`}>{label}</span>
      </div>
    </div>
  );
}
