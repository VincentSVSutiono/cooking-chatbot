# PRD: Beginner Cooking Companion

*Product doc. Loaded every session, so keep it short. Technical facts and constraints live in `docs/DECISIONS.md`. How the agent behaves lives in `AGENTS.md`.*

**Updating this file:** tick a step only after its "Done when" passes **and** the user can answer its "You can explain" question. Scope changes go in the Changes log below (date, what, why). Collapse finished steps to one line. Show the user the exact edit before saving it.

## 1. Overview

A cooking-only chatbot with a ChatGPT/Claude-style UI: streaming chat, plus a sidebar of past chats. It is a beginner's companion. The user is a beginner cook, so answers must assume no cooking knowledge. Recipes are grounded in real recipes (TheMealDB), not invented by the model.

It is a **personal-only** web app, deployed on Vercel, that works well in a phone browser so it can be used in the kitchen.

## 2. Goals

1. **Primary: learn.** LLM/chatbot integration and Next.js, end to end through deployment. The user should be able to explain what each step built.
2. **Secondary:** a tool the user actually uses while learning to cook.

## 3. Trust principles

1. **Ground in real recipes.** Retrieve similar real recipes (by similarity, so exact ingredients aren't required) and adapt them.
2. **Label every change.** Separate "from the source recipe" from "I changed this, double-check."
3. **Admit uncertainty.** On risky topics the bot says "I'm not sure, check this" instead of guessing.
4. **Safety facts come from code.** Safe temperatures and similar facts live in a fixed table, not model memory.
5. **Structured output, validated by code.** Recipes follow a schema and are checked before display.
6. **Never invent amounts or temperatures** that the source recipe doesn't state.

## 4. Scope

**In scope:** streaming chat, four ways in (ingredients, dish name, pasted link, image/file upload), web search grounding, recipe cards, cook-along mode, saved chat history, vector search over stored recipes, personal-only deploy, usable in a phone browser, minimal CI.

**Out of scope (not now, not never):**
- Training or fine-tuning a model. The project is about integrating an existing model.
- A native mobile app from an app store. The browser version covers phone use.
- Other users, sign-ups, or a public launch.

## 5. User flows

- **By ingredients:** user lists what they have, the app finds similar real recipes, shows a recipe card, and helps with substitutions in chat (labeling suggestions vs. the source recipe).
- **By dish name:** "I want to make carbonara" returns a recipe card with its ingredient list.
- **By link:** user pastes a recipe URL, the app imports it into the same recipe card.
- **By image or file:** user uploads a photo (e.g. ingredients/fridge or a cookbook page) or recipe file (PDF/text) for the companion to read and use.
- **Cook-along:** user picks a recipe and is walked through it one step at a time, with anything uncertain flagged.
- **General questions:** "what does simmer mean?" gets a beginner-friendly answer. Off-topic questions are politely declined.

## 6. Build steps

Each step ends with a working app. Load the named skills before the relevant work. Run `grill-me` before starting any step. Installed from the start: `grill-me`, `ai-sdk`, `frontend-ui-engineering`, `debugging-and-error-recovery`, `code-review-and-quality`. Skills marked (install) get installed when that step starts. Reach for `debugging-and-error-recovery` when something breaks and `code-review-and-quality` before merges. "Read first" names topics only: find the exact pages in the bundled docs (`node_modules/next/dist/docs/`, `node_modules/ai/docs/`) and don't guess page names.

### [x] Step 1: Streaming chat with a cooking system prompt — Done (Gemini models in `config/models.ts` & `config/ai.ts`, streaming route in `app/api/chat/route.ts`, responsive UI with model switcher).

### [x] Step 2: Dish-name search with tool calling — Done (TheMealDB search & normalizer in `lib/recipes/mealdb.ts`, tool in `lib/ai/tools.ts`, streaming loop with `stopWhen: isStepCount(3)` and tool logging in `app/api/chat/route.ts`, grounded prompt in `config/ai.ts`, tool status pill & attribution footer in UI).

### [x] Step 3: Structured recipe and recipe card — Done (Zod v4 schema in `lib/recipes/schema.ts`, Vitest unit test suite in `lib/recipes/__tests__/`, AI SDK `Output.object` structure pipeline in `lib/recipes/structure.ts`, two-step tool flow in `lib/ai/tools.ts`, `<RecipeCard />` with dynamic photo modal lightbox and collapsible steps, component separation and `InferUITools` types in `lib/ai/tools.ts`).

### [x] Step 4: Link import, web search, and file/image uploads — Done (SSRF-safe URL import with JSON-LD/notes/YouTube extraction in `lib/recipes/url-import.ts`, optional `notes` in `lib/recipes/schema.ts`, Tavily `webSearch` tool & `/extract` fallback in `lib/ai/tavily.ts`, multimodal upload resizing & server MIME validation in `lib/files/attachments.ts` & `app/api/chat/route.ts`, source footers & `RecipeNotesCollapsible` in UI).

### [x] Step 5a: Supabase and saved chats — Done (Supabase Postgres `chats` & `messages` tables in `lib/db/chats.ts`, per-turn `startSaveChat` + background `gemini-3.1-flash-lite` title summary in `lib/db/save-chat.ts` & `lib/ai/title.ts`, `/chat/[id]` route with `loading`/`error`/`not-found`, responsive `ChatShell` + `ChatSidebarServer` + `ChatSidebar` portal delete modal using `useDialogFocusTrap`, and `deleteChatAction`/`listChatsAction` Server Actions in `lib/db/actions.ts`).

### [x] Step 5b: Recipes in the database and vector search — Done (`gemini-embedding-2` 768-dim MRL embeddings in `config/ai.ts` & `lib/ai/embeddings.ts`, `public.recipes` + HNSW `match_recipes` RPC in `supabase/schema.sql`, lazy self-healing recipe repository in `lib/db/recipes.ts`, resumable `npm run db:seed` & `npm run db:compare` in `scripts/`, and `saveWebRecipeAction` + `<RecipeSaveButton />` on web-imported `<RecipeCard />`).

### [ ] Step 6: Multi-part sections, safety table, cook-along
- **Build:** optional sub-recipe `section` headings (e.g. sauce, topping, dough) for any multi-part recipe across extraction, schema, `<RecipeCard />`, and cook-along (leaving normal single-part recipes unchanged); a fixed safety table in code holds values taken from an official food-safety source (cited in DECISIONS.md); conversational substitution guidance in chat separates source recipe facts from suggested swaps; cook-along mode shows one step at a time with step-focused chat support.
- **Skills:** `ai-sdk`, `test-driven-development`, `frontend-ui-engineering`.
- **Read first:** AI SDK: structured output (revisit). An official food-safety source for the safety table. Next.js: client-side state.
- **Done when:** multi-part recipes from any site display their ingredient and instruction sections clearly on `<RecipeCard />` and in cook-along while normal single-part recipes stay unchanged. Any temperature in an answer comes from the table. A poultry recipe with no doneness check is flagged by a code check. Cook-along walks through every step and survives a page refresh. In testing, the bot says "I'm not sure, check this" on at least one risky question.
- **You can explain:** why safety facts live in code. Why multi-part sections live in the structured schema instead of flat strings. Where cook-along state lives and why.

### [ ] Step 7: Polish and deploy
- **Build:** friendly handling of rate limits (429) and errors, minimal CI (lint, type-check, tests, build), personal-only access (Vercel Authentication or an in-app login, decided here), deploy from `main` on Vercel, a once-daily keep-alive cron that runs a small database query, a `LICENSE` file (MIT for code, with TheMealDB data attribution), and a portfolio-ready `README`.
- **Skills:** `security-and-hardening`, `supabase`, `ci-cd-and-automation` (install, optional).
- **Read first:** Vercel docs on cron jobs, function duration and deployment protection (not bundled, so check the current online pages). GitHub Actions docs for CI. Next.js: error handling.
- **Done when:** a 429 shows a friendly message and a retry. CI runs on push and passes. The site is reachable only by the user (tested from a signed-out browser). The cron runs daily and touches the database (check logs). A long streamed reply works within Vercel's function duration limit. The TheMealDB personal-deployment question is answered or documented. `.env.example`, `LICENSE`, and the `README` are complete.
- **You can explain:** what CI checks and what it can't catch. Why only `main` goes to production and what preview deployments are. Why the cron must run a database query.

## 7. Changes log

- 2026-11-27: Removed structured recipe-card adaptation from Step 6; `<RecipeCard />` stays faithful to source recipes while ingredient substitutions are handled conversationally in chat (or via `webSearch`). Reason: avoids complex card-mutation UX when normal chat prompts cover swaps cleanly.
- 2026-11-27: Added optional sub-recipe sections (`section` / `dishPart`, never `group`) for multi-part recipes to Step 6 (single-part recipes remain unchanged). Reason: flattening multi-part recipes from any website makes steps like "Mix all ingredients" misleading for beginners and renders repeated ingredients across parts without context.
- 2026-11-27: Completed Step 5b (`gemini-embedding-2` 768-dim L2-normalized embeddings, Supabase `pgvector` `public.recipes` + HNSW `match_recipes` RPC, self-healing cached `getRecipeByIdFromDb`, resumable non-destructive `npm run db:seed` for 790 TheMealDB recipes, 6-query keyword vs. vector benchmark in `DECISIONS.md`, and `"Save to recipes"` persistence for web-imported recipe cards).
- 2026-11-25: Completed Step 5a (Supabase Postgres `chats`/`messages` persistence, `/chat/[id]` dynamic route with loading/error/not-found states, parallel LLM title summarization with deterministic fallback, responsive `ChatShell` sidebar with `deleteChatAction` & `listChatsAction`, and portal delete confirmation modal).
- 2026-11-21: Added saving validated web-imported recipes (`importUrlRecipe`) + embeddings to Supabase in Step 5b so the recipe database grows over time without re-searching the web.
- 2026-11-15: Completed Step 4 (link import with SSRF guards, recipe notes & YouTube video extraction; switched web search from Google Search Grounding to Tavily due to 0 free-tier quota; client-side image resize and server attachment validation).
- 2026-11-11: Completed Step 3 (Structured recipe schema, output validation with Vitest tests, two-step tool flow with compact match previews, full `<RecipeCard />` with dynamic attribution and photo modal lightbox, component separation and `lib/ai/types.ts`).

- 2026-11-09: Completed Step 2 (TheMealDB recipe search with normalizer and fallbacks, AI SDK tool calling, 3-step streaming route, grounded prompt, status pill, and per-message attribution).
- 2026-11-06: Added image/file uploads and web search to scope and Step 4 (YouTube links excluded). Reason: Gemini 3.x Flash/Flash-Lite natively accept multimodal inputs and `@ai-sdk/google` supports web search grounding, making them high-value additions for a cooking companion.
- 2026-11-06: Completed Step 1 (streaming chat, cooking system prompt, Claude-style responsive model switcher across 4 Gemini models, and quota error recovery).
