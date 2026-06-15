# 7 · RAG + MCP (index + pointer, fetch on demand)

> The capstone: RAG holds cheap summaries **plus a pointer** to a deeper doc; MCP serves that doc on demand. The agent retrieves, sees the pointer, and fetches only the doc it actually needs.

## What it does

1. **RAG** indexes the same summaries as variant 4 into Qdrant — but each payload
   also stores a `doc` pointer (e.g. `system-a.md`).
2. The question — *"How is system-a deployed, and how many replicas?"* — **can't be
   answered from the summary**; that detail lives only in the runbook.
3. The agent gets a `read_doc` **MCP tool**, follows the pointer, fetches
   [`docs/system-a.md`](docs/system-a.md), and answers.

## Mechanism

```
question ──embed──► Qdrant search ──► summary + "doc: system-a.md"
                                          │
                                          ▼  (answer not in summary)
                              MCP read_doc("system-a.md")  ──►  full runbook
                                          │
                                          ▼
                                        answer
```

The point: **the index stays small and semantic; the bulky source of truth is
fetched lazily**, only for the docs that retrieval surfaced as relevant. This is
how RAG and MCP compose in practice — RAG decides *what's relevant*, MCP fetches
*the authoritative detail*.

## Run

```bash
# Reuses the Qdrant from variant 4 (same instance, different collection):
docker compose -f 4-rag/docker-compose.yml up -d

npm run 7:rag-mcp
```

`index.ts` spawns `docs-server.ts` automatically via `npx tsx`.

## Trade-offs

| 👍 | 👎 |
|----|----|
| Tiny embedded index; heavy docs never embedded | Two systems to operate (vector DB + MCP server) |
| Deep content loaded only when relevant | Extra round-trip to fetch the doc |
| Authoritative docs stay in their own store | Pointer must be kept in sync with the doc store |

**Use when:** you have a large body of authoritative docs you don't want to embed wholesale — index summaries + pointers, fetch the full text on demand.
