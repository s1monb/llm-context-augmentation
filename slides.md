<!-- reveal.js markdown. `---` = new slide. No styling: titles + bullets only. -->

## Teaching an LLM your facts

- A brilliant expert — but walks in blank about *you* every time
- Knowledge frozen in training; no sending it back to school
- The game: brief it efficiently, every time

---

## The domain — Helix

- `system-a` — Team Aurora, Maya Chen, port 7654
- `system-b` — Team Borealis, Noah Kim, port 9310

> Who leads the team that owns system-a, and what port does it listen on?

---

## #1 · Context stuffing

Paste everything into the prompt.

- 👍 Zero infra
- 👎 Pays per token; dies past the context window

---

## #2 · Persistent memory

Markdown tree on disk, loaded in.

- 👍 Durable, editable
- 👎 Still loads everything

---

## #3 · Agentic retrieval

Agent picks which files to open.

- 👍 Only relevant files load
- 👎 Guesses from filenames; latency

---

## #4 · RAG

Embed all; fetch top-k by meaning.

- 👍 Scales to huge corpora
- 👎 Weak on relationships between docs

---

## #5 · GraphRAG

Match entity, traverse relationships.

- 👍 Multi-hop joins
- 👎 Building the graph is the hard part

---

## #6 · MCP

Knowledge behind a live tool, standard protocol.

- 👍 One client, any server
- 👎 More moving parts

---

## #7 · RAG + MCP

Index summary + pointer; MCP fetches the doc.

- 👍 Tiny index, fetch deep docs on demand
- 👎 Two systems to operate

---

## Which when?

- Small / static → stuffing
- Durable, navigable → memory (+ agentic)
- Large, changing → RAG
- Relationships → GraphRAG
- Behind a service → MCP

brute force → selective → structured → connected → standardized
