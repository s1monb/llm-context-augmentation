# 4 · RAG (vector retrieval)

> Embed everything, retrieve the passages most semantically similar to the question, and inject only those.

## What it does

1. Embeds the corpus locally (`all-MiniLM-L6-v2`, 384-dim) and upserts into **Qdrant**.
2. Embeds the question, runs a cosine-similarity search, takes the top 3 hits.
3. Stuffs **only those passages** into the prompt and answers.

## Mechanism

```
corpus ──embed──► Qdrant (vectors)
question ──embed──► nearest-neighbor search ──► top-k passages ──► LLM ──► answer
```

Retrieval is by **meaning**: the question about "the team that owns system-a"
pulls back both the `system-a` doc (port + owner) and the `Team Aurora` doc
(its lead) because both are semantically close — enough to answer here.

## Run

```bash
# 1. start the vector store
docker compose -f 4-rag/docker-compose.yml up -d

# 2. run the demo
npm run 4:rag
```

(First run downloads the embedding model, ~25 MB.)

## Trade-offs

| 👍 | 👎 |
|----|----|
| Scales to huge, changing knowledge bases | Needs an embedding model + vector store |
| Only relevant chunks reach context | Quality hinges on chunking + embedding quality |
| Easy to attach citations | Weaker when the answer needs *relationships* between docs (→ see graphrag) |

**Use when:** you have a large, changing corpus and questions map well to similar-looking passages.
