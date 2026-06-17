# Handoff — graphrag (teaching) + graphrag-pipeline

**Date:** 2026-06-17
Committed into **both** sibling repos so it travels with git (see "Cross-PC" at the end).

## TL;DR
Two sibling repos, split and on `main`. The most recent deliverable is a **presentation spec** (`graphrag/presentation.md`) for a reveal.js talk that a *separate* agent will turn into the actual deck. The pipeline repo (`../graphrag-pipeline`) is validated end-to-end.

## The two repos
- `graphrag` (this repo) — teaching collection, **TypeScript**. Variants `1-context-stuffing` … `7-rag-mcp`; each variant's `README.md` is the source of truth for its mechanism/trade-offs.
- `graphrag-pipeline` (sibling) — full **Python** pipeline: Firecrawl scrape → CAMEL extract → `normalize.py` → Neo4j → `query.py`. See its `README.md`.

> On the machine where this was authored, the full project memory also lived at
> `~/.claude/projects/-home-bjosim1-git-pax-priv-no-bjosim1-graphrag/memory/planned-repo-split.md`.
> That's local (not in git); this doc is the portable substitute.

## Most recent work — presentation spec
- `graphrag/presentation.md` — a reveal.js **spec/outline** (NOT a renderable deck): 20 slides, inline live demos, each slide carrying on-slide sketch + `TALKING POINTS` + `IMPL NOTES`. Arc: LLM fundamentals → in-prompt (1–3) → retrieval (4) → "RAG has more knobs" (one slide) → graphrag (5) → MCP/compose (6–7) → real pipeline → decision table.

## Likely next focus (pick one)
1. **Build the actual reveal.js deck** from `graphrag/presentation.md` (the spec explicitly defers this to a separate agent). Each `#n` slide's `IMPL NOTES` give the live-demo command + a "capture a backup screenshot" instruction — those screenshots don't exist yet.
2. **Node/entity dedup in the pipeline** — documented residual: `graphrag-pipeline/normalize.py` canonicalizes relation types/directions but does NOT dedupe nodes/labels (e.g. `system-a` under both `Service` and `System`). Entity resolution is the next improvement.
3. **Push both repos to a remote** for actual cross-PC use.

## Runtime / environment state
- On a fresh PC, no services exist — follow each repo's README to bring up Qdrant (`:6333`, variants 4 & 7), Neo4j (`:7687`, variant 5 & the pipeline), and self-hosted Firecrawl (`:3002`, pipeline). `graphrag-pipeline/setup.sh` re-clones Firecrawl.
- **Secrets (REDACTED):** a real `ANTHROPIC_API_KEY` is required; it lives in `graphrag/.env` and `graphrag-pipeline/.env`, both gitignored. Recreate from each repo's `.env.example` — never commit the value.
- `graphrag-pipeline/firecrawl/` (cloned, multi-GB) is gitignored; re-clone via `setup.sh`.

## Gotchas (already solved — don't re-discover)
APOC required on Neo4j for CAMEL's `Neo4jGraph`; Firecrawl needs `ALLOW_LOCAL_WEBHOOKS=true` for local URLs; call Firecrawl `/v1/scrape` over REST (the CAMEL loader breaks on firecrawl-py v2's `params=`); CAMEL needs an explicit `max_tokens`; leave sampling params unset for Opus 4.8. Details in `graphrag-pipeline/README.md` and `graphrag-pipeline/normalize.py`.

## Key artifacts (paths)
- Spec: `graphrag/presentation.md`
- Per-technique detail: `graphrag/<n>-*/README.md`; pipeline: `graphrag-pipeline/README.md`

## Suggested skills for the next session
- **`claude-api`** — when touching any Claude/Anthropic SDK code (model IDs, params); the pipeline relies on `claude-opus-4-8` + the "no sampling params" rule.
- **`run`** / **`verify`** — bring services up and confirm a demo or the pipeline works before/after changes.
- **`code-review`** or **`simplify`** — after building the deck or editing pipeline code.
- Building the deck needs no dedicated skill — work directly from `presentation.md`; it is self-describing for a reveal.js builder.

## Cross-PC
This `HANDOFF.md` is committed in both `graphrag` and `graphrag-pipeline`. To continue elsewhere: `git push` both repos, clone on the other PC, recreate each `.env` from its `.env.example`, then point a fresh Claude session at this file. (Being logged into the same Claude account does NOT carry the conversation over — Claude Code transcripts are local to each machine.)
