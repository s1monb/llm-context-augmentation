# 3 · Agentic retrieval over persistent memory

> Same markdown store as #2 — but the model decides which files to open instead of being handed everything.

## What it does

Gives the model two tools and lets it drive:

- `list_memory_files` — see what's available
- `read_memory_file(path)` — open one file

The agent typically lists the store, notices `systems/system-a.md` and
`teams/aurora.md` look relevant, reads just those, and answers — without ever
loading `system-b.md`, `borealis.md`, etc.

## Mechanism

```
question ──► LLM ──► list_memory_files ──► LLM picks files
                  └─► read_memory_file(...) ──► LLM ──► answer
        (loop until the model stops calling tools)
```

Reuses [`../2-persistent-memory/memory/`](../2-persistent-memory/memory) — **same
knowledge, different access pattern**. This is the difference between "load the
whole store" and "let the agent retrieve."

## Run

```bash
npm run 3:agentic
```

(Watch the `[tool]` lines to see which files it chose to read.)

## Trade-offs

| 👍 | 👎 |
|----|----|
| Only relevant files hit the context window | Multiple round-trips → higher latency |
| Scales to a large store | Retrieval quality depends on the model's judgment |
| No embedding infrastructure | The agent can miss a relevant file |

**Use when:** the store is too big to load wholesale and the structure (names, index) is descriptive enough for the model to navigate.
