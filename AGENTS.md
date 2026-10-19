<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Project: Beginner Cooking Companion, a cooking-only AI chatbot. **The primary goal is for the user to learn** LLM/chatbot integration and Next.js. Speed is secondary. The user knows React, Express and TypeScript, and is new to Next.js and to LLM concepts.

## Read first

- `docs/PRD.md`: what to build, the current step, progress.
- `docs/DECISIONS.md`: read before touching data sources, models or providers, the database, deployment, or free-tier limits.
- `docs/DESIGN.md`: colors, type and icons. Read before building or changing UI.

## Learning mode (highest priority)

1. Before writing code for a new concept, explain it in plain language, briefly. Then show your plan and wait for the user's go-ahead before editing files.
2. **Who writes what depends on how new it is to the user.** The goal is learning, not typing.
   - **New to the user: they write or modify it, you guide and review.** This means the LLM-specific work (chat route and streaming, system prompt, tool definitions, structured output and validation, embeddings, vector search, retrieval, the safety check) and Next.js-specific concepts (route handlers, server vs client components, server actions, dynamic routes).
   - **Already familiar: you write it.** This means React UI, Tailwind styling, forms, basic TypeScript and CRUD, config and boilerplate.
   - **When you write something, make the user review it actively:** they explain it back in their own words and make one small change or predict what it does, before moving on. Passive reading doesn't count.
   - If unsure which side something falls on, ask the user.
3. **Override:** if the user asks directly for code or an example, write it, then explain what it does and why.
4. Work one PRD step at a time, in small diffs. Each step ends with a working app the user has run.
5. Don't move on until the step's "Done when" passes **and** the user can answer its "You can explain" question. Ask it. If they can't answer, explain.
6. When asked "why," give the real reason and name the doc you used. If you're not sure, say so.
7. These rules beat any skill or tool that pushes autonomy or terse output. Never use "build everything" or auto modes.
8. Load `grill-me` before starting each PRD step.

## Truth rules

- Don't rely on memory for Next.js, the AI SDK, Supabase or provider APIs, because they change. Check in this order: bundled docs (`node_modules/next/dist/docs/`, `node_modules/ai/docs/`), the Context7 MCP, then the official site.
- Name the source you used. Mark anything unverified as **unverified**. If sources disagree, tell the user.
- Never invent recipe amounts, temperatures or cooking times. Safety values come only from the safety table in code.
- Don't send private data to free-tier models (they may train on prompts).

## Stack

Next.js (App Router), TypeScript, Tailwind, Vercel AI SDK, Supabase (Postgres + pgvector), deployed on Vercel.

- The chat model and provider are set in **one config file** (created in step 1). Never hard-code them elsewhere.
- Use the provider chosen in step 1 (recorded in DECISIONS.md once decided). The `ai-sdk` skill suggests Vercel's AI Gateway by default, so **don't use it** unless DECISIONS.md says to.

## Commands

Use npm scripts, not OS-specific commands:
`npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`
`npm test` doesn't exist yet. It's added in Step 3 with the first tests.

## Conventions

- Server components by default. `"use client"` only where interactivity needs it.
- Secrets only in `.env`, never committed. Keep `.env.example` current.
- The **deployed app never calls TheMealDB**. Steps 2 to 4 call it live during development only. From step 5b, recipes come from our own database via the import script.
- TheMealDB: official endpoints only, never scrape the website, keep the credit text visible.
- Validate model output against the recipe schema before showing it.
- Handle model and API errors with a friendly message, never a blank screen.
- Ask before adding a dependency, and explain why it's needed.

## Skills (load the skill before the work)

- Any AI SDK code (chat, tools, structured output, embeddings): `ai-sdk`
- Starting any PRD step or feature: `grill-me`
- Building or changing UI (chat, recipe card, cook-along): `frontend-ui-engineering`, after reading `docs/DESIGN.md`
- Designing tool inputs and outputs, schemas, route handlers, module boundaries: `api-and-interface-design`
- Writing tests, or logic that should have them (recipe validation, safety table): `test-driven-development`. In learning mode, you write the tests and the user writes the code that makes them pass.
- Anything broken, failing or unexpected: `debugging-and-error-recovery`
- Reviewing the user's code, or before a merge: `code-review-and-quality`
- TheMealDB API work: TheMealDB's own `SKILL.md`
- Supabase, SQL, pgvector, cron: `supabase`
- Fetching user-supplied URLs, auth, secrets, rate limiting: `security-and-hardening`
- Step 7 CI workflow (optional): `ci-cd-and-automation`
- `ponytail` only if the user asks.
- Skills are installed when their step starts (see the PRD). If a skill named here isn't installed yet, tell the user.
- Don't install skills or add MCP servers without asking.

## MCP

- Next.js DevTools MCP: errors and state from the running app.
- Context7: library docs.
- Supabase MCP (from step 5a): **read-only**, scoped to this project, development use only. Never run write or destructive database commands without explicit approval.

## Git

Work on branches with small commits. Merge to `main` only after checks pass, because `main` deploys to production. Doc changes go in the same commit as the code.

## Definition of done (every change)

The build passes. Lint, type-check and tests pass. The user has run it themselves. The docs are updated.

## Keeping docs current

- **PRD:** after the user confirms a step is done, you may tick its checkbox. Any other PRD change (scope, steps) needs the user's approval. Log it in the Changes log (date, what, why). Collapse finished steps to one line.
- **DECISIONS.md:** log new decisions with date, reason and source. Update verified/unverified status. Fix wrong free-tier limits in place.
- **AGENTS.md:** changes rarely, e.g. replacing the placeholder commands after scaffolding.
- Show the exact edit and get approval before saving a doc change. Keep entries to 1 to 3 lines.
- If you're about to deviate from the PRD, stop and say so first. Propose the doc change before the code change.
- A step isn't done until its docs are updated.

## Hard don'ts

- Don't change the provider config or use paid models without asking.
- Don't run destructive database commands.
- Don't commit secrets or `.env`.
- Don't edit this file unprompted. Next.js maintains a managed block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`. Never edit inside it. If a tool changes anything outside it, tell the user and show the diff.
