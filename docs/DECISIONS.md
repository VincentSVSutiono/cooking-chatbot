# DECISIONS.md

_Reference doc: the technical facts and constraints behind our choices. Read it before touching data sources, models or providers, the database, deployment, or free-tier limits. It is not loaded every session._

**Status tags:** **[verified]** was checked against an official page, **[unverified]** was not. "Checked Oct 2026" means during planning. Free tiers change often, so re-check a number before relying on it, and update it here in place when it's wrong. New decisions go in the Decision log at the bottom.

## 1. Recipe data: TheMealDB

- **Decision:** use TheMealDB's official API and copy recipes into our own database. The deployed app never calls it. Steps 2 to 4 call it live during development only. From step 5b the recipes come from our database via an import script.
- **Free key:** test key `1` is for development and educational use. Public release or production use needs their paid supporter key. **[verified, checked Oct 2026]** (themealdb.com/api.php, /terms_of_use.php)
- **Terms:** copying and modifying content returned by the **official endpoints** is allowed. Don't scrape the website, don't resell the data, keep copyright notices, credit the source. **[verified]**
- **Credit text:** `Recipe data and imagery: TheMealDB (https://www.themealdb.com/)`
- **Free-key limits per their docs:** the filter takes a single ingredient (multi-ingredient is premium), and list results are capped at 100 items. We do multi-ingredient matching ourselves from our own database. **Real limits and recipe count: 790 unique recipes across a–z, 26 sequential requests in 8.4s (~325ms/req) with 0 rate limiting on test key 1. [verified, step 2]**
- **Their own guidance for AI use:** keep original measures, don't infer temperatures. **[verified]** They publish `themealdb.com/AGENTS.md`, `/SKILL.md` and OpenAPI specs, plus docs at themealdb.com/documentation.
- **Open:** is a personal-only deployment on the free key acceptable? Ask them by email before step 7. The supporter price is **[unverified]**.
- **Rejected sources:**
  - **Spoonacular:** terms forbid storing or copying data, including derived, hashed or transformed data (so embeddings count). Only the recipe ID, title and image URL may be kept. **[verified]**
  - **Edamam:** the free plan caches only the recipe ID and name, and its recipes link out without cooking instructions. **[verified]**
  - **RecipeNLG:** its card says non-commercial research and education only, and part of it is scraped. Another catalog lists "no known license". **[verified]**
  - Kaggle datasets: **[unverified]**, not checked.
- **Link import (step 4):** many recipe sites embed machine-readable recipe data, but site terms and bot-blocking vary. **[unverified]** Check terms before relying on a site.

## 2. Database: Supabase (Postgres + pgvector)

- **Decision:** Supabase for chat history and recipe vectors. Development uses the Supabase project directly (no local database). Firebase was considered. Firestore does support vector search, but it's NoSQL, so not chosen.
- **Free tier:** about 500 MB. **[verified, check supabase.com/pricing]**
- **Pausing:** a free project pauses after about 7 days of low activity. Pausing doesn't delete data. "Resume project" restores data and settings. The official docs gave a 90-day resume window (another copy said 1 year), after which the project may be deleted. **[verified, but the window figure is inconsistent, check the current docs]**
- **Safety net:** the import script rebuilds recipes from an empty database. Chat history is the only thing not rebuildable, so export it now and then. One unconfirmed report of an empty table after a restore, so keep backups.
- **Supabase MCP:** development and testing only. Scope it to this project and keep it read-only. **[verified]**

## 3. LLM provider

- **Design:** shared model IDs live in `config/models.ts` (client-safe) and provider instantiation lives in `config/ai.ts` (`server-only`). Nothing provider-specific anywhere else, so swapping is a config change.
- **Chat model:** Google Gemini (`@ai-sdk/google` via Google AI Studio free tier), selectable in UI between `gemini-3.6-flash`, `gemini-3.5-flash-lite` (default), and `gemini-3.1-flash-lite` (`gemini-3.8-flash` dropped in step 2 due to silent stream failures). **[verified, step 2]**
- **Embedding model:** a separate model, decided in step 5b. Zen lists none, so it will come from another provider. Free options **[unverified]**. Changing it later means re-embedding every recipe, because vectors from different models can't be compared.

### Swap checklist (use for any provider)

1. Does it support **tool calling**, and is it reliable at it? Free models are often flaky, so test it.
2. Does it support **structured output**?
3. **Rate limits:** requests per minute and per day, tokens per minute.
4. Does it **train on prompts**?
5. Which **endpoint type and AI SDK package** does it need?
6. Is the **context window** enough for recipe context plus chat history?

### Snapshot: OpenCode Zen (checked Oct 2026, expect drift)

- Endpoint `https://opencode.ai/zen/v1`, model list at `/models`, works with the AI SDK. **[verified]**
- Free models are marked limited-time and rotate. Muse Spark 1.3 Contributor Free is listed as free at opencode.ai/docs/zen (checked 2026-10-20) in exchange for letting Meta train on prompts and completions. Endpoint URL differs between sources (`/zen/v1/responses` in the docs vs `/inference/v1/responses` on one aggregator), and API behavior, rate limits and tool calling are untested **[unverified]**. Other free models listed: Big Pickle, MiMo-V2.5 Free, Ling 3.0 Flash Fin Free, Nemotron 3 Ultra Free, Nemotron 3.5 Lightning Free, Jev 1.13 Free.
- Muse Spark uses the `/responses` endpoint (`@ai-sdk/openai`). Most other free models use `/chat/completions` (`@ai-sdk/openai-compatible`). Crossing that line means a few lines changed in the config file. **[verified]**
- Setup asks for billing details, and auto-reload tops up $20 when the balance drops below $5. **Turn auto-reload off and set a monthly limit.** **[verified]**
- Free-model rate limits aren't stated in the docs. Zen is framed as a gateway for coding agents, so app use is **[unverified]**. A GitHub issue reported HTTP 500 errors via API key for Muse Spark 1.2 free, so test 1.3 early.

### Snapshot: fallback providers (limits change often)

- **Gemini (AI Studio):** free tier exists, Pro models are no longer free per several blogs, free-tier data may be used for training, and exact limits differ across sources. Check AI Studio. **[unverified numbers]**
- **Groq:** its docs list gpt-oss-120b at 30 requests/min, 1K/day, but only 8K tokens/min. The page doesn't make clear which plan those figures belong to. The token cap matters for RAG. **[partly verified]**
- **OpenRouter:** `:free` models allow 20 requests/min, and 50/day unless 10 or more credits were bought, then 1,000/day. **[verified]**

## 4. Hosting, access, CI/CD, cron

- **Hosting:** Vercel Hobby, which is for non-commercial personal use. **[verified]** Function duration is unclear (docs said 10s default up to 60s, a blog said 300s). **Check the current docs before relying on it, since streaming matters.** **[unverified]**
- **Personal-only access:** Vercel Authentication or an in-app login, decided in step 7. Whether Vercel Authentication is available on Hobby is **[unverified]**. This protects the free-model quota.
- **CD:** Vercel's Git integration deploys merges to the production branch (`main` by default) and creates preview deployments for other branches. **[verified]**
- **CI:** one minimal GitHub Actions workflow (lint, type-check, tests, build), added in step 7. CI and Vercel likely run independently, so a failing check may not stop a deploy. **[unverified]** Habit: work on branches, merge to `main` after checks pass. GitHub Actions free limits **[unchecked]**.
- **Keep-alive cron:** Vercel Hobby cron runs once per day at most, at some point within the scheduled hour. **[verified]** The route must run a small database query. Whether Vercel Authentication blocks the cron request is **[unverified]**, test it. Fallbacks: in-app login, or a scheduled GitHub Actions job.

## 5. Tooling: MCP and skills

- **Environment:** Fedora 44 (GNOME), Zed editor, OpenCode CLI 2.0.32, and AGY CLI 1.3.6 (Google's Antigravity CLI, command `agy`, the successor to the Gemini CLI). Node v22.23.1 and git 2.56.0. **[checked on the user's machine]**
- **Zed and OpenCode:** connect through ACP. Run `opencode auth login` in a terminal first, then add an `agent_servers` entry in `~/.config/zed/settings.json` with `command` `opencode` and `args` `["acp"]`. If Zed can't find `opencode`, use the absolute path from `which opencode`. ACP uses the project's own config, skills, instructions and MCP servers, and permission requests show a diff. **[verified in the v2 docs]** Whether Zed can host AGY is **[unchecked]**. Use AGY in the terminal.
- **Two agents, one setup:** both read `AGENTS.md`, so it's shared. Both read `.agents/skills/`, so install skills there and both see them. **[verified]** MCP is configured separately per tool: OpenCode in `opencode.json`, AGY with `agy mcp add|list` or `.agents/mcp_config.json`. Sources disagree on AGY's global config path, so use the commands. Only one agent edits at a time, and commit between them.
- **AGY notes:** permissions use `allow`, `ask` and `deny` lists with entries like `command(git status)`, and precedence is deny > ask > allow (the opposite of OpenCode, where the last match wins). `opencode.json` does not apply to AGY, so AGY has no `git push` deny rule and relies on its `request-review` mode: always choose "allow once". Add MCP servers with `agy mcp add [flags] <name> <url-or-command>`, with flags first and `--` before a command that starts with `-`. AGY's MCP config file path is **[unverified]**, sources conflict. `grill-me` has `disable-model-invocation: true`, so in AGY the user types `/grill-me`. Whether OpenCode honors that field is **[unverified]**.
- **MCP (fewer is better, each adds tokens every turn):**
  - Next.js DevTools MCP, `npx -y next-devtools-mcp@latest`. Runtime features need Next.js 16+.
  - Context7, remote at `https://mcp.context7.com/mcp`, for libraries that don't bundle docs.
  - Supabase MCP from step 5a, at `https://mcp.supabase.com/mcp`, read-only.
  - OpenCode v2 format (verified in the v2 docs): servers go under `mcp.servers`, each with a `type` (`local` or `remote`), and `disabled: true` replaces V1's `enabled`. V2 still reads V1-style config, but `opencode.json` uses the native v2 shape. `opencode mcp add` and `opencode mcp list` manage servers, and `/mcps` inside OpenCode shows status. Remote servers use OAuth by default, so if `context7` shows `needs authentication`, sign in from `/mcps`.
- **OpenCode v2 notes (verified in the v2 docs):**
  - **Default permissions allow everything**, including edits, shell commands, and access outside the project. Only `.env` reads ask by default. Our `opencode.json` overrides this: edits and shell commands ask, `git status|diff|log` are allowed, `git push` is denied, and outside folders ask. The last matching rule wins.
  - **Don't choose "Allow always" for edits.** It saves the tool's proposed pattern for the project, and for edits that is `*`, which would turn off the prompt. Use "Allow once" while learning.
  - **Instructions:** `instructions` still works (files, globs, URLs). V2 reads `AGENTS.md` only, with no `CLAUDE.md` fallback, and picks up `AGENTS.md` edits mid-session.
  - **Skills:** `.agents/skills` is still discovered. The skill ID is the directory name, and skills without a `description` aren't advertised. The agent loads a skill with the `skill` tool, and you can load one yourself by writing `@skill-id` in a prompt.
  - **No language servers:** V2 doesn't run LSP, so rely on the lint, type-check and build commands.
- **Skills used:** `ai-sdk`, `grill-me`, `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`, `security-and-hardening`, `supabase`, TheMealDB's `SKILL.md`, optional `ci-cd-and-automation`, and `ponytail` only on request. Each is installed when its step starts (see the PRD). Installed 2026-10-20 in `.agents/skills/` (verified: both CLIs list all five): `grill-me` (mattpocock/skills), `ai-sdk` (vercel/ai), and `frontend-ui-engineering`, `debugging-and-error-recovery`, `code-review-and-quality` (addyosmani/agent-skills). Skills and agent folders are gitignored.
- **Skills skipped, and why:**
  - **Superpowers:** built for the agent to work autonomously with mandatory, auto-triggering workflows, which fights the learning rules.
  - **`using-agent-skills`:** a router for the full pack. AGENTS.md already maps work to our skills.
  - **`caveman`:** terse replies fight the learning goal.
  - **`find-skills`:** not needed, and its Snyk audit showed a warning.
  - **`teach`:** builds a lesson workspace that would clutter the repo.
  - **Spec and planning skills:** the PRD is written by hand.
  - **`incremental-implementation`, `git-workflow-and-versioning`, `documentation-and-adrs`:** AGENTS.md and this file cover them.
  - **`source-driven-development`:** matches the Truth rules. Add only if the agent skips doc checks.
  - **Heavier skills** (performance, observability, deprecation, shipping): too much for a personal app.
  - **`vercel-react-best-practices`:** 70 performance rules, maybe at polish.
- **Install notes:** format is `npx skills add <repo> --skill <name>`. Read each `SKILL.md` and check audits at skills.sh first (`supabase` and `find-skills` showed a Snyk warning). Confirm which folder it writes to (`.opencode/skills` or `.agents/skills`). A per-skill install from Addy's repo doesn't copy its shared `references/` checklists (issue #361), so copy the accessibility, testing and security ones in if wanted. Skills may not trigger on their own, which is why AGENTS.md names them.
- **`ai-sdk` skill:** points at docs bundled in `node_modules/ai/docs/` (ai 6.0.34 and later). It defaults to Vercel's AI Gateway, which we don't use.
- **Next.js agent files (corrected):** from Next.js 16.2, `create-next-app` generates `AGENTS.md` and `CLAUDE.md` (opt out with `--no-agents-md`). When `next dev` detects an AI agent and no managed block exists, it creates or updates `AGENTS.md` and `CLAUDE.md`, and content **outside** the managed block is preserved. The block sits between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->`. Never edit inside it. It tells agents to read the docs in `node_modules/next/dist/docs/`. `agentRules` in `next.config` controls this. **[verified, Next.js docs]** Plan: let `create-next-app` generate its files, then paste our AGENTS.md content outside the managed block.
- **Next.js requirements:** Node.js 20.9 or later and TypeScript 5.1 or later. **[verified]**

## 6. Open items

- [ ] Email TheMealDB about a personal-only deployment _(user, before step 7)_
- [x] TheMealDB free-key real limits and recipe count (790 unique recipes across a–z, 0 rate limit on 26 rapid requests) _(step 2)_
- [x] Test tool calling compatibility on chosen Gemini models (reliable tool calling & strict grounding) _(step 2)_
- [ ] Test search grounding compatibility on chosen Gemini models _(step 4)_
- [ ] Zen: does Muse Spark 1.3 free work via API key, what are its rate limits, is app use allowed _(step 1)_
- [ ] Pick the embedding model _(step 5b)_
- [ ] Safety table values: take from an official food-safety source and cite it here _(step 6)_
- [ ] Link import: site terms _(step 4)_
- [ ] Vercel function duration on Hobby, Vercel Authentication on Hobby, cron vs Vercel Authentication _(step 7)_
- [x] Skills install into `.agents/skills/` and both CLIs list them
- [x] Versions checked: OpenCode 2.0.32, AGY 1.3.6, Node v22.23.1, git 2.56.0
- [x] Confirm the permission prompts behave as intended (edits and shell ask) _(first session)_
- [x] `context7` connects in OpenCode, and both CLIs returned a Context7 result in the setup check
- [ ] Confirm `next-devtools` is disabled in `agy mcp list` _(setup)_
- [x] Check which AI SDK version npm installs (`ai@^7.0.157`, `@ai-sdk/react@^4.0.161`, `@ai-sdk/google@^4.0.108`) and verified bundled docs in `node_modules/ai/docs/` _(step 1)_
- [x] Test whether `browser_eval` in `next-devtools-mcp` covers browser automation _(tested in step 1; user also tested directly on desktop/tablet/phone via LAN)_

## 7. Decision log

_(Newest first. Format: `YYYY-MM-DD: decision, reason, source.`)_

- 2026-11-09: Dropped gemini-3.8-flash from AVAILABLE_MODELS, leaving 3 selectable Gemini models (3.6-flash, 3.5-flash-lite default, 3.1-flash-lite). Reason: 3.8-flash produced empty response streams during live testing. Source: user verification in step 2.
- 2026-11-09: Verified TheMealDB test key 1 contains 790 recipes across a-z with ~325ms average latency and reliable tool-calling on Gemini models. Reason: empirical verification for Step 2. Source: live testing against TheMealDB and Gemini 3.x.
- 2026-11-06: Expanded Step 4 in `docs/PRD.md` to include web search grounding (`google.tools.googleSearch`) and multimodal file/image uploads alongside URL link import. Reason: Gemini 3.x Flash/Flash-Lite natively support image/PDF/text inputs and `@ai-sdk/google` includes built-in search grounding. Source: `node_modules/@ai-sdk/google/dist/index.d.ts` and Google AI Studio docs.
- 2026-11-06: Chose Google Gemini (`@ai-sdk/google`) with 4 selectable models (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` default, `gemini-3.1-flash-lite`) split across `config/models.ts` (client-safe list) and `config/ai.ts` (`server-only` provider). Reason: free tier on Google AI Studio with instant fallback when a model hits per-model rate limits (HTTP 429 / `RESOURCE_EXHAUSTED`). Source: verified in `node_modules/@ai-sdk/google/dist/index.d.ts` and live testing.
- 2026-10-20: Added `docs/DESIGN.md` (warm cream and butter-yellow light theme, dark brown text, one accent plus a warning color, contrast checked by the user). Reason: avoid a generic AI look. AGENTS.md now says to read it before UI work.
- 2026-10-20: Browser automation deferred. Enable `next-devtools` at step 1 and test `browser_eval` before adding a separate Playwright MCP. Reason: fewer MCPs means fewer tokens per turn.
- 2026-10-19: Learning mode split by novelty, not one default. The user writes what is new to them (LLM, RAG, Next.js-specific) and the agent writes what they already know (React UI, styling, basics), with active review of anything the agent writes. Reason: the user already knows React, Express and TypeScript and wants to learn the LLM and Next.js parts. Source: Anthropic's skill-formation study (arXiv 2601.20245) found question-driven AI use preserved comprehension better than delegation. AGENTS.md rule 2 updated.
