# 2 · Persistent memory (markdown hierarchy)

> Knowledge lives in a structured, on-disk markdown tree that survives across runs and is human-editable.

## What it does

Loads the entire [`memory/`](memory/) hierarchy — an index plus topic files under
`services/` and `policies/` — and injects it into the prompt.

```
memory/
├── MEMORY.md            # index (entry point)
├── systems/
│   ├── system-a.md
│   └── system-b.md
├── teams/
│   ├── aurora.md        # owns system-a; lead Maya Chen
│   └── borealis.md      # owns system-b; lead Noah Kim
└── policies/
    └── rate-limits.md
```

## Mechanism

```
[ read whole memory/ tree ] + [ question ]  ──►  one LLM call  ──►  answer
```

Still "stuffing" at the LLM boundary, but the knowledge is now a **persistent,
curated, navigable store** rather than a throwaway blob. The same files are
reused by variant 3.

## Run

```bash
npm run 2:memory
```

## Trade-offs

| 👍 | 👎 |
|----|----|
| Persists across sessions; version-controllable | Still loads everything → same context-cost ceiling as #1 |
| Human-readable and editable | No relevance filtering |
| Natural structure (index + topics) | |

**Use when:** you want durable, editable knowledge but the store is still small enough to load wholesale.
