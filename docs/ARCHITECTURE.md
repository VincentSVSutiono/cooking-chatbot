# ARCHITECTURE.md

*Code organization, module boundaries, and naming conventions established in the `refactor/clean-architecture` cleanup after Step 4. Read before adding or refactoring files, types, tools, or components.*

---

## 1. Folder & Module Ownership

Keep files grouped by **domain/feature**, not by generic technical bucket (avoid catch-all `utils/`, `helpers/`, or `types/` folders).

### `app/` — Next.js App Router entrypoints
- Pages, layouts, and API route handlers (`app/api/chat/route.ts`).
- Keep route handlers thin: validate inputs, delegate work to `config/` and `lib/`, map errors (e.g., quota `429`, overloaded `503`) to clear responses, and stream/return.

### `config/` — App-wide configuration (split by client/server boundary)
- `config/models.ts` — **client-safe** model IDs (`AVAILABLE_MODELS`, `DEFAULT_MODEL_ID`, `ModelId`). Safe to import in `"use client"` components.
- `config/ai.ts` — **`"server-only"`** provider wiring (`getChatModel`, `getEmbeddingModel`, `EMBEDDING_MODEL_ID`, `EMBEDDING_DIMENSIONS`) and `COOKING_SYSTEM_PROMPT`. Never hard-code provider SDKs or model IDs anywhere else.

### `lib/` — Domain logic & external integrations
- `lib/ai/`
  - `tools.ts` — thin glue defining AI SDK tools (`createCookingTools`) and deriving all UI tool/message types via `InferUITools` (`CookingTools`, `ChatMessage`, `CookingToolPart`, `RecipeCardToolPart`). **Do not create manual duplicate part-type files** (replaces deleted `lib/ai/types.ts`).
  - `embeddings.ts` — `gemini-embedding-2` 768-dim MRL embedding helpers (`formatRecipeForEmbedding`, `normalizeVector`, `embedRecipeDocument`, `embedRecipeDocumentsBatch`, `embedSearchQuery`).
  - `tavily.ts` — external Tavily API client (`/search`, `/extract`), named after the service it wraps.
  - `title.ts` — `gemini-3.1-flash-lite` 3–5 word chat title summarizer (`generateChatTitleSummary`).
- `lib/db/` — Supabase persistence, chat-turn coordination, recipe repository, and Server Actions:
  - `client.ts` — singleton server-only Supabase admin client (`getSupabaseAdminClient`).
  - `chats.ts` — Postgres `chats`/`messages` CRUD, UUID validation, message mapping, and fallback title generation.
  - `recipes.ts` — `public.recipes` repository (`searchRecipesInDb` via `match_recipes` RPC, lazy self-healing `getRecipeByIdFromDb`, `saveWebRecipeToDb`, `buildWebRecipeId`, and CLI seed/benchmark helpers).
  - `save-chat.ts` — per-turn `startSaveChat` orchestrator (pre-stream save + background title with 1.5s stream-end cap).
  - `actions.ts` — `"use server"` Server Actions (`deleteChatAction`, `listChatsAction`, `saveWebRecipeAction`).
- `lib/recipes/` — recipe pipeline split by stage:
  - `schema.ts` — Zod schemas & validation (`StructuredRecipe`, `validateRecipe`).
  - `mealdb.ts` — external TheMealDB API client & normalizer (`NormalizedMealDbRecipe`).
  - `url-import.ts` — SSRF URL guard (`assertSafeRecipeUrl`), safe direct HTML fetch (`fetchSafeUrlHtml`), fetch error helpers (`isTransientFetchFailure`, `formatFetchErrorMessage`), and JSON-LD/notes/page-text extraction (`extractUrlRecipe`, `ExtractedUrlRecipe`).
  - `structure.ts` — LLM `Output.object` structuring pipelines (`structureMealDbRecipe`, `structureUrlRecipe`) and tool output unions (`GetRecipeOutput`, `ImportUrlRecipeOutput`).
  - `format-text.ts` — pure text/note-reference parsing helpers for UI rendering.
- `lib/files/`
  - `attachments.ts` — single owner of attachment constants (`MAX_IMAGE_FILES`, `MAX_DATA_URL_LENGTH`, allowed MIME types) plus browser resize & server validation helpers. Don't split tiny constant files away from the module that owns them.
- **Tests:** co-located in `__tests__/` inside each domain folder (`lib/ai/__tests__/`, `lib/recipes/__tests__/`), named `<module>.test.ts` matching the file under test.

### `components/` — React UI grouped by what it renders
- `components/chat/` — conversation shell & chat primitives (`ChatShell`, `ChatSidebarServer`, `ChatSidebar`, `ChatInterface`, `ChatHeader`, `ChatWelcomeScreen`, `ChatInputBar`, `ChatMessageItem`, `ToolStatusPill`).
- `components/recipes/` — **all** `Recipe*` components (`RecipeCard`, `RecipeSaveButton`, `RecipeMatchList`, `RecipeAttribution`, `RecipeImageModal`, `RecipeStepsCollapsible`, `RecipeNotesCollapsible`, `RecipeExpandButton`, `RecipeFormattedText`). Group by what the component displays, not where it was first imported.

### `scripts/` — CLI database & benchmark scripts
- `register-node.mjs` — Node 22 `registerHooks` loader stubbing `"server-only"` and resolving `@/*` aliases for CLI scripts.
- `seed-mealdb.ts` (`npm run db:seed`) — resumable, TPM-paced TheMealDB importer that preserves `source_type = 'web'` rows.
- `compare-search.ts` (`npm run db:compare`) — 6-query keyword vs. pgvector search benchmark.

### `hooks/` — Generic `"use client"` browser/DOM hooks
- Reusable DOM-only hooks with no app/AI/DB coupling: `useAutogrowTextarea.ts`, `useVisualViewport.ts`, `useDialogFocusTrap.ts`. Keep feature-specific hooks local to their owning component.

---

## 2. Naming Conventions

| Kind | Convention | Examples |
|---|---|---|
| Component files | `PascalCase.tsx` with domain prefix | `ChatInputBar.tsx`, `RecipeMatchList.tsx` |
| `lib/` & `config/` files | `kebab-case.ts` named by service or stage | `mealdb.ts`, `tavily.ts`, `url-import.ts`, `format-text.ts` |
| Test files | `<module>.test.ts` inside `__tests__/` | `tavily.test.ts`, `mealdb.test.ts`, `url-import.test.ts` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_IMAGE_FILES`, `TAVILY_EXTRACT_URL` |
| Event handlers | `handle*` (internal), `on*` (props) | `handleOpen`, `onSelectRecipe` |
| Booleans | `is*` / `has*` | `isBusy`, `hasMatches`, `isTransientFetchFailure` |
| Multi-state UI | String union, not overloaded booleans | `"loading" \| "loaded" \| "error"` |
| Pure helpers | Verb-first `camelCase` | `formatFetchErrorMessage`, `splitRecipeNoteRefs` |

### External API Wrappers (`mealdb.ts`, `tavily.ts`)
- **Raw vendor wire types:** prefix with `<Vendor><Action>*` (e.g., `TavilySearchResultItem`, `TavilySearchResponse`, `TavilyExtractResultItem`, `TavilyExtractResponse`, `MealDbRawMeal`).
- **Shared client options:** `<Vendor>RequestOptions` with optional dependency injection (`{ apiKey?, fetchFn? }`, or `{ lookupFn?, fetchFn? }`) so unit tests run offline without mutating globals.
- **Public functions & types:** start with the **action** so distinct operations read unambiguously side by side (`searchWebPage` / `SearchWebPageSource` / `SearchWebPageOutput` vs `extractWebPage` / `ExtractWebPageOutput`).

### AI SDK Tools (`lib/ai/tools.ts`)
- Tool keys use verb-first `camelCase`: `searchRecipes`, `getRecipe`, `importUrlRecipe`, `webSearch`.
- Keep tool keys distinct from imported domain helper names so no import aliases are needed (`webSearch` calls `searchWebPage`; `searchRecipes` calls `searchMealDbRecipes`).
- Every tool returns a **discriminated union** with a `status` (or `found`) field (`"success" | "not-found" | "fetch-error" | "not-a-recipe" | "validation-error" | "error" | "unconfigured"`). Never let raw uncaught errors crash a tool execution.

### Canonical Recipe Field Names
Normalize vendor fields at the boundary (Stage 1 raw → Stage 2 normalized → Stage 3 structured). Never leak vendor aliases (`strMeal`, `strSource`, `thumbUrl`, `image`) past the normalizer:
- `id`, `title`
- `ingredients`: `{ item: string; amount: string }[]`
- `instructions` (raw string in Stage 2) → `steps` (`string[]` in Stage 3)
- `thumbnailUrl`, `sourceUrl`, `youtubeUrl`
- `category`, `area`
- `times`: `{ prep, cook, total }`
- `safetyNote`, `notes`

---

## 3. Splitting & Boundary Rules

Key rules from `refactor/clean-architecture` to preserve in every future step:

1. **Keep `lib/ai/tools.ts` thin.** Fetch, parsing, SSRF, and error-formatting helpers live in their domain modules (`lib/recipes/url-import.ts`, `lib/recipes/mealdb.ts`, `lib/ai/tavily.ts`), not at the top of `tools.ts`.
2. **Derive tool UI types from `createCookingTools`.** Use `InferUITools<ReturnType<typeof createCookingTools>>` as the single source of truth for `ChatMessage` and `CookingToolPart`.
3. **Keep UI state local to the owning component.** Draft text and pending file attachments live inside `ChatInputBar`; starter prompt constants live inside `ChatWelcomeScreen`. Only lift state to `ChatInterface` when siblings need it.
4. **One switch / resolver per tool union.** Render tool parts through a single `switch (part.type)` (`ChatMessageItem.tsx`, `resolveToolPill` in `ToolStatusPill.tsx`) rather than scattered `if/else` guards.
5. **Merge tiny single-export files.** Keep constants in the module that owns the feature (`lib/files/attachments.ts`) instead of maintaining 10-line `constants.ts` files.
6. **Design external I/O for offline tests.** Accept optional `{ fetchFn?, lookupFn?, apiKey? }` on network/API functions so Vitest runs fast and offline.

---

## 4. Placement Guide for Upcoming Steps (Steps 5–7)

- **Step 5a (Supabase & saved chats):** `lib/db/` for Supabase clients, chat/message queries, and DB types; `app/chat/[id]/` for dynamic chat route + `loading.tsx` / `error.tsx`; `components/chat/` for chat history sidebar components.
- **Step 5b (Recipes DB & pgvector):** `lib/db/recipes.ts` for recipe storage & vector search queries; `lib/ai/embeddings.ts` for embedding generation; `scripts/` for the TheMealDB seed/import script.
- **Step 6 (Adaptation, safety table, cook-along):** `lib/recipes/safety.ts` (+ `__tests__/safety.test.ts`) for the fixed safety table & poultry check; `components/recipes/` for cook-along UI.
- **Step 7 (Polish & deploy):** `app/api/cron/` for the daily keep-alive route; `.github/workflows/` for minimal CI.
