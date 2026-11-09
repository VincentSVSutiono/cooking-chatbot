export const STARTER_PROMPTS_POOL = [
  "What is an easy, 20-minute dinner recipe for a complete beginner?",
  "How do I dice an onion safely without crying?",
  "What are some of the most essential cooking tools a total beginner actually needs?",
  "I have eggs, cheese, and bread in my kitchen. What can I make?",
  "How do I cook fluffy white rice on the stove without burning the bottom?",
  "What does it mean to simmer something, and what should it look like in the pan?",
  "How do I pan-sear chicken breast so it stays juicy and tender?",
  "What are 3 quick, beginner-friendly recipes I can try this week?",
  "What is the difference between sautéing and pan-frying?",
];

export function pickRandomPrompts(pool: string[], count = 3): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export interface ChatWelcomeScreenProps {
  prompts: string[];
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export default function ChatWelcomeScreen({
  prompts,
  onSelectPrompt,
  disabled = false,
}: ChatWelcomeScreenProps) {
  return (
    <section
      aria-labelledby="welcome-heading"
      className="my-1 sm:my-auto flex flex-col items-start gap-3.5 sm:gap-6 rounded-xl border border-border bg-surface p-4 sm:p-7"
    >
      <div className="space-y-1.5 sm:space-y-2">
        <h2
          id="welcome-heading"
          className="font-serif text-xl sm:text-2xl font-semibold text-text"
        >
          Welcome to your kitchen companion
        </h2>
        <p className="max-w-[65ch] text-sm sm:text-base leading-relaxed text-text-muted">
          Ask about quick recipes, ingredients in your fridge, or cooking
          techniques. I&apos;ll guide you step by step with zero judgment!
        </p>
      </div>

      <div className="w-full space-y-2 sm:space-y-2.5">
        <p className="text-xs sm:text-sm font-medium text-text-muted">
          Try asking one of these to start:
        </p>
        <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              disabled={disabled}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3.5 sm:px-4 py-2.5 sm:py-3 text-left text-sm sm:text-base leading-snug sm:leading-relaxed text-text transition-colors hover:border-accent-strong hover:bg-user-message focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
