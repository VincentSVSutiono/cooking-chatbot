import { ChevronDown, ChevronUp } from "lucide-react";

interface RecipeExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  expandedLabel: string;
  collapsedLabel: string;
}

/**
 * Shared >=44px full-width accordion button used by collapsible recipe sections.
 */
export default function RecipeExpandButton({
  isExpanded,
  onToggle,
  expandedLabel,
  collapsedLabel,
}: RecipeExpandButtonProps) {
  const Icon = isExpanded ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      <Icon className="h-4 w-4 text-accent-strong" aria-hidden="true" />
      <span>{isExpanded ? expandedLabel : collapsedLabel}</span>
    </button>
  );
}
