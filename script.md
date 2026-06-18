# Script — teaching an LLM your facts

TODOs
- [ ] Add good intro (expand the motivation below — consultant / locum metaphor)
- [ ] Show the domain-documents (walk the Helix knowledge base + the question)

The spine: **brute-force-everything-every-time → progressively more selective,
structured, connected, and standardized.** Each technique fixes the previous one's
pain. This is the narration; `slides.md` is the bare deck.

## Intro / motivation

You hired the smartest expert in the world — and every morning they show up having
forgotten everything about *you*. Their training is done and unchangeable; you
*could* send them back to school (fine-tuning), but it's slow, costly, and locks
you out of the newest models. So the whole game becomes: **how do we brief them
efficiently, every single time?** Each technique below is a smarter brief.

## The domain

The Helix platform: `system-a` is owned by Team Aurora (lead Maya Chen, port 7654);
`system-b` by Team Borealis (lead Noah Kim, port 9310). Every technique answers the
same two-hop question — *who leads the team that owns system-a, and what port does
it listen on?* — system → owning team → its lead. The model can't know any of it,
so a correct answer proves the technique worked.

## #1 · Context stuffing

Paste the whole knowledge base into the prompt.

- 👍 Zero infra, trivial, always sees everything (no retrieval misses)
- 👎 Pays for every token on every call; dies once knowledge outgrows the context window

**→ #2:** We want that knowledge to outlive a single request and be editable.

## #2 · Persistent memory

A structured markdown tree on disk, loaded and stuffed in.

- 👍 Persists across runs, version-controllable, human-editable; real structure (index + topics)
- 👎 **Still loads everything** → same cost ceiling as #1; no relevance filtering

**→ #3:** Stop pre-loading the whole store — let the expert fetch what it needs.

## #3 · Agentic retrieval over memory

Same store, but the agent decides which files to open (`list` + `read` tools).

- 👍 Only relevant files reach the context; scales to a large store; no embedding infra
- 👎 Multiple round-trips (latency); relevance hinges on the model's judgment over filenames — it can miss a file

**→ #4:** Retrieve by *meaning*, not by guessing from names.

## #4 · RAG (vector retrieval)

Embed everything; fetch only the top-k chunks most similar to the question.

- 👍 Scales to huge, changing corpora; only relevant chunks reach context; easy citations
- 👎 Needs an embedding model + vector store; weak when the answer needs **relationships** between docs

**→ #5:** Some answers are a jump across documents, not one similar passage.

## #5 · GraphRAG

Match the entity the question names, then **traverse** its relationships.

- 👍 Multi-hop joins (system-a → Team Aurora → Maya Chen); retrieves *connected* context; explainable paths
- 👎 Needs a graph + an entity/relationship model; building the graph from raw docs is the hard part

**→ #6:** What if the knowledge lives behind a live service, not a file?

## #6 · MCP — the protocol layer

Knowledge behind a live tool, over a standard protocol ("USB-C for AI").

- 👍 One client works with *any* MCP server (swappable); live data, not a pre-built index
- 👎 More moving parts + tool-loop latency; the server must be running

**→ #7:** Combine the last two — RAG to find what's relevant, MCP to fetch the detail.

## #7 · RAG + MCP

The index holds a summary + a pointer; MCP fetches the deep doc on demand.

- 👍 Tiny index (heavy runbooks never embedded); deep content loaded only when relevant
- 👎 Two systems to operate (vector DB + MCP server); the pointer must stay in sync with the doc store

## Which technique when?

- Small / static → context stuffing
- Durable, editable, navigable → memory (+ agentic)
- Large, changing corpus → RAG
- Answers depend on relationships → GraphRAG
- Knowledge behind a service → MCP

Most real systems combine several. The arc: **brute force → selective → structured
→ connected → standardized.**
