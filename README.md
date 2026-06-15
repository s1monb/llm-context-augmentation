# Adding knowledge to an LLM — seven variants

Seven small, runnable demos showing different ways to give a model knowledge it
never learned in training. **No fine-tuning** — every variant here keeps the
model frozen and injects knowledge at inference time (the other half of the
landscape, changing weights via LoRA / fine-tuning, is out of scope).

The shared fictional domain ([`shared/knowledge.ts`](shared/knowledge.ts)): the
**Helix** platform has two systems, `system-a` (owned by **Team Aurora**) and
`system-b` (owned by **Team Borealis**), each team with a lead and engineers.

Variants 1–6 all answer the **same question**, so the techniques are directly
comparable:

> *"Who leads the team that owns system-a, and what port does system-a listen on?"*

It's a two-hop question (system → owning team → lead), which is where graph
retrieval pulls ahead. Variant 7 answers a deeper question whose answer lives
only in a technical runbook. The base model can't know any of this, so a correct
answer proves the technique worked.

Actually *building* the graph that variant 5 (graphrag) queries — scraping real
docs and extracting a graph from them — lives in a separate, fully-featured
pipeline repo: [`../graphrag-pipeline`](../graphrag-pipeline) (Python: Firecrawl →
CAMEL + Claude → normalize → Neo4j → query). This repo keeps the techniques in
isolation for teaching.

## The variants

| # | Folder | Technique | Knowledge lives… | Infra |
|---|--------|-----------|------------------|-------|
| 1 | [`1-context-stuffing`](1-context-stuffing) | Paste everything into the prompt | in the request | — |
| 2 | [`2-persistent-memory`](2-persistent-memory) | Load a markdown memory tree | on disk (markdown) | — |
| 3 | [`3-agentic-memory`](3-agentic-memory) | Agent reads only the files it needs | on disk (markdown) | — |
| 4 | [`4-rag`](4-rag) | Vector similarity retrieval | in a vector DB | Qdrant (docker) |
| 5 | [`5-graphrag`](5-graphrag) | Entity match + graph traversal | in a graph DB | Neo4j (docker) |
| 6 | [`6-mcp`](6-mcp) | Tools over the Model Context Protocol | behind an MCP server | stdio server |
| 7 | [`7-rag-mcp`](7-rag-mcp) | RAG index + pointer, MCP fetches the doc | vector DB + doc files | Qdrant (docker) |

The order tells a story in three acts: **1–3** keep knowledge *in the prompt*
(stuff it → persist it as files → let the agent retrieve from those files);
**4–5** move it to *external retrieval* (vector similarity, then relationship
traversal — same question, and **5** is the one that makes the two-hop jump);
**6** introduces MCP as the *protocol* layer (knowledge behind a live tool); and
**7** composes **4 + 6** — RAG finds *what's relevant*, MCP fetches *the
authoritative detail*. (MCP sits at 6, not on the retrieval spectrum, because
it's plumbing — but it's the setup 7 builds on.)

## Setup

```bash
npm install                 # installs deps + downloads nothing yet
cp .env.example .env        # then add your ANTHROPIC_API_KEY
```

Requirements: Node 22+, an `ANTHROPIC_API_KEY`, and Docker (only for variants 4, 5 & 7).
Embeddings run locally via `transformers.js` — no embeddings API key needed.

## Run

```bash
npm run 1:context     # context stuffing
npm run 2:memory      # persistent markdown memory
npm run 3:agentic     # agentic retrieval over that memory

docker compose -f 4-rag/docker-compose.yml up -d        && npm run 4:rag
docker compose -f 5-graphrag/docker-compose.yml up -d   && npm run 5:graphrag

npm run 6:mcp         # MCP server + client (server is spawned automatically)

docker compose -f 4-rag/docker-compose.yml up -d        && npm run 7:rag-mcp   # reuses Qdrant
```

Each folder has its own `README.md` with the mechanism diagram and trade-offs.

## Layout

```
shared/         claude client · local embeddings · the shared knowledge base
1-context-stuffing/
2-persistent-memory/   (memory/ markdown tree, reused by #3)
3-agentic-memory/
4-rag/                 (+ docker-compose.yml → Qdrant)
5-graphrag/            (+ docker-compose.yml → Neo4j)
6-mcp/                 (server.ts + client.ts)
7-rag-mcp/             (docs/ runbooks + docs-server.ts; reuses #4's Qdrant)
```
