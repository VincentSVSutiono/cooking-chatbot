# DECISIONS.md

*Reference doc: the technical facts and constraints behind our choices. Read it before touching data sources, models or providers, the database, deployment, or free-tier limits. It is not loaded every session.*

**Status tags:** **[verified]** was checked against an official page, **[unverified]** was not. "Checked Oct 2026" means during planning. Free tiers change often, so re-check a number before relying on it, and update it here in place when it's wrong. New decisions go in the Decision log at the bottom.

## 1. Recipe data: TheMealDB

- **Decision:** use TheMealDB's official API and copy recipes into our own database. The deployed app never calls it. Steps 2 to 4 call it live during development only. From step 5b the recipes come from our database via an import script.
- **Free key:** test key `1` is for development and educational use. Public release or production use needs their paid supporter key. **[verified, checked Oct 2026]** (themealdb.com/api.php, /terms_of_use.php)
- **Terms:** copying and modifying content returned by the **official endpoints** is allowed. Don't scrape the website, don't resell the data, keep copyright notices, credit the source. **[verified]**
- **Credit text:** `Recipe data and imagery: TheMealDB (https://www.themealdb.com/)`
- **Free-key limits per their docs:** the filter takes a single ingredient (multi-ingredient is premium), and list results are capped at 100 items. We do multi-ingredient matching ourselves from our own database. **Real limits and recipe count: [unverified], test in step 2.**
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

- **Design:** provider and model live in **one config file** (created in step 1). Nothing provider-specific anywhere else, so swapping is a config change.
- **Chat model:** decided in step 1. Current candidate: OpenCode Zen free models, but any provider can replace it.
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
- Free models are marked limited-time and rotate. Muse Spark 1.3 Contributor Free is free in exchange for letting Meta train on prompts and completions. **[verified]**
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
- **Skills used:** `ai-sdk`, `grill-me`, `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`, `security-and-hardening`, `supabase`, TheMealDB's `SKILL.md`, optional `ci-cd-and-automation`, and `ponytail` only on request. Each is installed when its step starts (see the PRD).
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

- [ ] Email TheMealDB about a personal-only deployment *(user, before step 7)*
- [ ] TheMealDB free-key real limits and recipe count *(step 2)*
- [ ] Pick the chat model and test tool calling on it *(step 1 and 2)*
- [ ] Zen: does Muse Spark 1.3 free work via API key, what are its rate limits, is app use allowed *(step 1)*
- [ ] Pick the embedding model *(step 5b)*
- [ ] Safety table values: take from an official food-safety source and cite it here *(step 6)*
- [ ] Link import: site terms *(step 4)*
- [ ] Vercel function duration on Hobby, Vercel Authentication on Hobby, cron vs Vercel Authentication *(step 7)*
- [ ] Confirm the skills CLI installs into `.agents/skills/` (shared by OpenCode and AGY) *(setup)*
- [x] Versions checked: OpenCode 2.0.32, AGY 1.3.6, Node v22.23.1, git 2.56.0
- [ ] Confirm the permission prompts behave as intended (edits and shell ask) *(first session)*
- [ ] Confirm `context7` connects in `opencode mcp list` *(setup)*

## 7. Decision log

*(Newest first. Format: `YYYY-MM-DD: decision, reason, source.`)*

- 2026-10-19: Learning mode split by novelty, not one default. The user writes what is new to them (LLM, RAG, Next.js-specific) and the agent writes what they already know (React UI, styling, basics), with active review of anything the agent writes. Reason: the user already knows React, Express and TypeScript and wants to learn the LLM and Next.js parts. Source: Anthropic's skill-formation study (arXiv 2601.20245) found question-driven AI use preserved comprehension better than delegation. AGENTS.md rule 2 updated.
