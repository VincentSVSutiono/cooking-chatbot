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

- **By ingredients:** user lists what they have, the app finds similar real recipes, adapts one and labels the changes, and shows a recipe card.
- **By dish name:** "I want to make carbonara" returns a recipe card with its ingredient list.
- **By link:** user pastes a recipe URL, the app imports it into the same recipe card.
- **By image or file:** user uploads a photo (e.g. ingredients/fridge or a cookbook page) or recipe file (PDF/text) for the companion to read and use.
- **Cook-along:** user picks a recipe and is walked through it one step at a time, with anything uncertain flagged.
- **General questions:** "what does simmer mean?" gets a beginner-friendly answer. Off-topic questions are politely declined.

## 6. Build steps

Each step ends with a working app. Load the named skills before the relevant work. Run `grill-me` before starting any step. Installed from the start: `grill-me`, `ai-sdk`, `frontend-ui-engineering`, `debugging-and-error-recovery`, `code-review-and-quality`. Skills marked (install) get installed when that step starts. Reach for `debugging-and-error-recovery` when something breaks and `code-review-and-quality` before merges. "Read first" names topics only: find the exact pages in the bundled docs (`node_modules/next/dist/docs/`, `node_modules/ai/docs/`) and don't guess page names.

### [x] Step 1: Streaming chat with a cooking system prompt — Done (Gemini models in `config/models.ts` & `config/ai.ts`, streaming route in `app/api/chat/route.ts`, responsive UI with model switcher).

### [ ] Step 2: Dish-name search with tool calling
- **Build:** a tool the model can call to search TheMealDB by dish name. This calls the live API during development only. Step 5b replaces it with our own database, so keep the tool's inputs and outputs stable and only the data source behind it changes.
- **Skills:** `ai-sdk`, `api-and-interface-design` (install), TheMealDB's `SKILL.md` (install).
- **Read first:** AI SDK: tool calling. TheMealDB's API docs (themealdb.com/documentation).
- **Done when:** "I want to make carbonara" triggers the tool (visible in logs) and the reply uses what it returned. A dish not found gets an honest "couldn't find it," not an invented recipe. No amounts appear that weren't in the tool result. TheMealDB credit is shown. The free key's real limits and recipe count are tested and written to DECISIONS.md.
- **You can explain:** what "the model calls a tool" really means (it requests, our code runs it). Why the result goes back into the conversation. What happens when the model doesn't call the tool.

### [ ] Step 3: Structured recipe and recipe card
- **Build:** a recipe schema (title, ingredients with amounts, steps, times, safety note, source), validation of model/tool output against it, and a recipe card UI.
- **Skills:** `ai-sdk`, `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development` (install).
- **Read first:** AI SDK: structured output and schemas. Next.js: composing server and client components.
- **Done when:** a recipe request renders as a card, not a wall of text. A deliberately malformed result is caught and handled. The card shows its source and credit.
- **You can explain:** why validate model output with code instead of trusting it. What a schema is and how the SDK uses it to shape output. Which card parts are server vs client components.

### [ ] Step 4: Link import, web search, and file/image uploads
- **Build:** a tool that takes a URL, fetches the page, and extracts the recipe into the same schema; web search grounding so the model can look up cooking facts online; and image/file attachments in the chat input so the user can upload photos (e.g. ingredients) or recipe files (PDF/text).
- **Skills:** `ai-sdk`, `security-and-hardening` (install), `frontend-ui-engineering`.
- **Read first:** AI SDK: tool calling (revisit), multimodal/file attachments, provider search tools. The `security-and-hardening` skill's guidance on input validation and user-supplied URLs.
- **Done when:** a link from a site with embedded recipe data produces the same card. An unreachable or non-recipe page gives a clear message. Only http(s) URLs are accepted, and requests to local or private addresses are refused. Web search answers a live cooking query. Uploading an image or file in chat works and the model reads its contents. The site-terms question in DECISIONS.md is resolved or consciously accepted.
- **You can explain:** why the model can't just "read" a URL without a tool. Why fetching user-supplied URLs is risky and which check guards it. How web search grounding differs from fetching a single URL. How multimodal file/image parts are sent to the model.

### [ ] Step 5a: Supabase and saved chats
- **Build:** a Supabase project, tables for chats and messages, a sidebar of past chats, and a `/chat/[id]` route with loading and error states.
- **Skills:** `supabase` (install), `frontend-ui-engineering`.
- **Read first:** Next.js: dynamic routes, server actions, loading and error UI. Supabase: its Next.js integration docs (via the `supabase` skill or Context7).
- **Done when:** refreshing keeps the conversation. Past chats list in the sidebar. `/chat/[id]` opens the right chat. Deleting a chat works. Database credentials are only in `.env`. Any Supabase MCP access is read-only.
- **You can explain:** why we store messages when the model is stateless. How a dynamic route works. When to use a server action vs a route handler. What happens to our data if Supabase pauses.

### [ ] Step 5b: Recipes in the database and vector search
- **Build:** an import script that copies TheMealDB recipes (official endpoints) into Supabase, an embedding model (chosen here), embeddings for every recipe, and vector search replacing the live TheMealDB calls from step 2.
- **Skills:** `supabase`, `ai-sdk`.
- **Read first:** Supabase: vectors and pgvector. AI SDK: embeddings.
- **Done when:** one command rebuilds the recipe table from an empty database. An ingredient-list query returns sensible recipes without exact matches. At least 5 queries are compared against keyword search, with results written to DECISIONS.md. The dish-name tool now reads from our database. The embedding model is recorded in DECISIONS.md.
- **You can explain:** what an embedding is. Why vector search finds "something warm with chicken" when keywords don't. Why changing the embedding model means re-embedding every recipe.

### [ ] Step 6: Adaptation, safety table, cook-along
- **Build:** the model adapts a retrieved recipe to the user's ingredients and labels each change. A fixed safety table in code holds values taken from an official food-safety source (cited in DECISIONS.md). Cook-along mode shows one step at a time.
- **Skills:** `ai-sdk`, `test-driven-development`, `frontend-ui-engineering`.
- **Read first:** AI SDK: structured output (revisit). An official food-safety source for the safety table. Next.js: client-side state.
- **Done when:** adapted recipes list changes separately from source content. Any temperature in an answer comes from the table. A poultry recipe with no doneness check is flagged by a code check. Cook-along walks through every step and survives a page refresh. In testing, the bot says "I'm not sure, check this" on at least one risky question.
- **You can explain:** why safety facts live in code. How the app knows what the model changed vs the source. Where cook-along state lives and why.

### [ ] Step 7: Polish and deploy
- **Build:** friendly handling of rate limits (429) and errors, minimal CI (lint, type-check, tests, build), personal-only access (Vercel Authentication or an in-app login, decided here), deploy from `main` on Vercel, a once-daily keep-alive cron that runs a small database query, and a README.
- **Skills:** `security-and-hardening`, `supabase`, `ci-cd-and-automation` (install, optional).
- **Read first:** Vercel docs on cron jobs, function duration and deployment protection (not bundled, so check the current online pages). GitHub Actions docs for CI. Next.js: error handling.
- **Done when:** a 429 shows a friendly message and a retry. CI runs on push and passes. The site is reachable only by the user (tested from a signed-out browser). The cron runs daily and touches the database (check logs). A long streamed reply works within Vercel's function duration limit. The TheMealDB personal-deployment question is answered or documented. `.env.example` and the README are complete.
- **You can explain:** what CI checks and what it can't catch. Why only `main` goes to production and what preview deployments are. Why the cron must run a database query.

## 7. Changes log

- 2026-11-06: Added image/file uploads and web search to scope and Step 4 (YouTube links excluded). Reason: Gemini 3.x Flash/Flash-Lite natively accept multimodal inputs and `@ai-sdk/google` supports web search grounding, making them high-value additions for a cooking companion.
- 2026-11-06: Completed Step 1 (streaming chat, cooking system prompt, Claude-style responsive model switcher across 4 Gemini models, and quota error recovery).
