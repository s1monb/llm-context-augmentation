---
title: "Teaching your LLM new facts — from embeddings to a real graphrag pipeline"
target: reveal.js
status: SPEC / OUTLINE — the actual deck is built later by a separate agent from this file
---

<!--
DECK AGENT BRIEF — read me first.

WHAT THIS FILE IS: a SPEC/OUTLINE for a ~35–45 min technical talk. It is NOT the
deck. A separate agent will build the real deck in reveal.js from this file. Treat
everything here as source material to translate, not as final slide markup.

Each slide below has three parts:
  • the on-slide content sketch (headings / short bullets / code / a diagram placeholder)
  • <!-- TALKING POINTS --> : the narration the presenter says (the build-up).
  • <!-- IMPL NOTES --> : instructions for the deck builder (diagrams to draw,
    source files to pull snippets from, the live-demo command + what to point at,
    a backup screenshot to capture, reveal.js layout/fragment hints, callbacks).
    IMPL NOTES are NOT on-slide text — turn them into speaker notes or drop them.

TARGET: reveal.js. `---` marks a slide boundary; speaker notes go in reveal's
`Note:` / `<aside class="notes">`. Keep on-slide text sparse; the talking points
carry the content. Prefer one diagram per slide over bullet walls.

NARRATIVE RULE: the talk BUILDS ON ITSELF. Every act's first slide calls back to
the previous one. Keep those callbacks (flagged in IMPL NOTES).

DEMOS ARE INLINE: every technique slide has a live demo. Before the talk, start
the services (see slide 6 notes) so runs are instant. Capture a backup screenshot
of each demo's output in case a service is down.

SOURCE OF TRUTH: distill diagrams/trade-offs from each variant's own README in
graphrag/<n>-*/README.md and graphrag-pipeline/README.md — don't invent new framings.
-->

# Teaching your LLM new facts

### from token embeddings → RAG → a real graphrag pipeline

your data was never in the weights — here's the menu of fixes

<!-- TALKING POINTS: One sentence to set the frame. "Every team eventually asks:
how do I get a model to answer questions about MY systems, MY docs, MY data — the
stuff it was never trained on? Today we build up the whole menu of answers, from
how the model works to a production pipeline, one layer at a time." -->
<!-- IMPL NOTES: Title slide. Big title, small subtitle. Optional: a faint
left→right arrow motif (embeddings → retrieval → graph → pipeline) previewing the
arc. No demo here. -->

---

# The problem

A frozen model can't know your private or changing facts.

> *"What port does the **Zephyr** service listen on, and what's our API rate limit?"*
> → confident, wrong, or "I don't know."

<!-- TALKING POINTS: The model's knowledge is whatever was in its training data,
frozen at a cutoff. Your internal services, this week's incident, your customer's
plan — none of it is in there. Worse, it may hallucinate a plausible answer. The
rest of this talk is: how do we get the RIGHT answer in front of the model at the
moment it answers? But first — why CAN'T it just know? Two quick slides on how a
model turns text into something it can compute on. -->
<!-- IMPL NOTES: Use a concrete "miss" — a made-up internal service name. Show a
red ✗ on a hallucinated answer. Sets up the fundamentals detour. No demo. -->

---

# How text becomes vectors

Token + position embeddings = **learned lookup tables, summed**

```
"system-a"  → token id 5  → WTE[5]  (a learned C-dim vector)
   position 0             → WPE[0]  (a learned C-dim vector)
   input  = WTE[5] + WPE[0]
```

<!-- TALKING POINTS: Two lookup tables. One maps each token id to a learned vector
(what the token is). One maps each position to a learned vector (where it sits).
You add them. That's the input to the network. The key word is LEARNED — these
vectors were fixed during training. Hold onto "lookup + add"; the same idea —
turning text into vectors you can compare — comes back when we hit RAG. -->
<!-- IMPL NOTES: Diagram: two stacked lookup tables (WTE, WPE) → row select → ⊕ →
input vector. Credit/echo bbycroft.net/llm visual style. This is a planted seed:
flag the callback — slide 11 (RAG) reuses "text → vector → compare". No demo. -->

---

# Attention, in one breath

Each word **gathers information from other words**.

- **Query** — what I'm looking for
- **Key** — what I offer
- **Value** — the info I hand over

match my Query against everyone's Keys → blend their Values

<!-- TALKING POINTS: ELI-12 version. Every word makes three things: a Query (what
I need), a Key (what I am), a Value (my info). A word compares its Query to every
other word's Key, and pulls in a weighted blend of their Values. That's how "it"
figures out it refers to "the animal." This is the engine — but notice: it only
ever mixes information that's ALREADY in the prompt. It cannot reach outside. -->
<!-- IMPL NOTES: Simple Q/K/V diagram, one sentence with "it → the animal" arrow.
Don't go deeper than this — it's context, not the topic. Land the punchline
("only mixes what's already in the prompt") because it motivates the pivot. No demo. -->

---

# The pivot

Weights are **frozen** after training → the model can't *contain* your facts.

## So we put the facts in front of it — at inference time.

<small>(The other half — *changing* the weights via fine-tuning — is a different talk.)</small>

<!-- TALKING POINTS: Put the two previous slides together. The weights are fixed;
attention only mixes what's in the prompt. So the entire game is: get the right
facts INTO the context at answer time. That's "knowledge injection," and there's a
whole menu of ways to do it — that's the rest of the talk. You COULD instead
change the weights — fine-tuning, continued pre-training — great for teaching
behavior/style, poor for facts that change. We're not covering that today. -->
<!-- IMPL NOTES: This is the hinge slide — make it visually distinct (full-bleed,
big type). One-line fine-tuning aside only; do not expand. Transition: "menu of
ways" → next slide introduces the running example used for the whole menu. No demo. -->

---

# One question, seven answers

Domain: the **Helix** platform.
`system-a` (owned by **Team Aurora**) · `system-b` (owned by **Team Borealis**)

**The question every technique will answer:**
> *Who leads the team that owns system-a, and what port does system-a listen on?*

✅ Maya Chen (Team Aurora) · port 7654

<!-- TALKING POINTS: To compare techniques fairly, they all answer the SAME
question against the SAME tiny fictional knowledge base. It's a two-hop question on
purpose — system → owning team → who leads it — which will matter later when we
hit graphs. The base model can't know any of this, so a correct answer proves the
technique worked. -->
<!-- IMPL NOTES: Source: graphrag/shared/knowledge.ts (facts) — keep names exact.
Small entity diagram: Person→Team→System→port. DEMO SETUP banner for the presenter
(presenter notes): before the talk run `npm install` in graphrag/, set
ANTHROPIC_API_KEY in graphrag/.env, and start services so later demos are instant:
`docker compose -f 4-rag/docker-compose.yml up -d` (Qdrant, used by #4 & #7),
`docker compose -f 5-graphrag/docker-compose.yml up -d` (Neo4j, #5). No demo on
this slide. -->

---

# #1 · Context stuffing

Paste the whole knowledge base into the prompt.

```
[ all docs ] + [ question ]  →  one LLM call  →  answer
```

👍 zero infra, always sees everything 👎 pays for every token, doesn't scale

<!-- TALKING POINTS: The crudest, most reliable move: put everything in the prompt.
No retrieval, no database. Watch — first I ask with no context (it whiffs), then I
paste the corpus and it nails it. It works because the facts are now literally in
the context attention can mix over. The catch: you pay for every token every call,
and it dies the moment your knowledge outgrows the context window. -->
<!-- IMPL NOTES: Source: graphrag/1-context-stuffing/README.md. LIVE DEMO:
`npm run 1:context` — point at the baseline "I don't know" vs the correct answer
after stuffing. Backup screenshot of both outputs. Callback: "facts in the context"
ties to slide 4 (attention mixes what's present). -->

---

# #2 · Persistent memory

A structured, on-disk **markdown tree** — survives runs, human-editable.

```
memory/  MEMORY.md (index)
  systems/system-a.md   teams/aurora.md   policies/…
```

<!-- TALKING POINTS: Same "stuff it in the prompt" idea, but now the knowledge is a
persistent, curated markdown hierarchy with an index — not a throwaway blob. This
is the shape of agent "memory" files. We load the tree and inject it. The win is
durability and structure; the limit is the same as #1 — we're still loading
everything. -->
<!-- IMPL NOTES: Source: graphrag/2-persistent-memory/README.md (reuse its tree
diagram). LIVE DEMO: `npm run 2:memory` — point at "Loaded N markdown files" then
the answer. Backup screenshot. Callback: "still loading everything → same ceiling
as #1" sets up #3. -->

---

# #3 · Agentic retrieval over memory

Same store — but the **agent decides which files to open**.

```
list_memory_files → read_memory_file(...)  (loop until done)
```

<!-- TALKING POINTS: Same markdown store as #2, but instead of dumping it all, we
hand the model two tools — list files, read a file — and let it choose. It lists
the store, sees system-a.md and aurora.md look relevant, reads just those, answers.
Now only relevant content hits the context. This is the first "retrieval" — but
driven by the model's judgment over filenames, not by math. -->
<!-- IMPL NOTES: Source: graphrag/3-agentic-memory/README.md. LIVE DEMO:
`npm run 3:agentic` — point at the [tool] lines showing it chose system-a.md +
aurora.md, NOT the others. Backup screenshot. Transition: "judgment over filenames"
→ what if the store is huge / names aren't descriptive? → retrieval by meaning. -->

---

# Why retrieve at all?

When the knowledge base won't fit in the prompt, **fetch only what's relevant**.

🔁 Remember slide 3 — *text → vector → compare*? Now do it over **whole documents**.

<!-- TALKING POINTS: Stuffing and memory both cap out at the context window.
Retrieval breaks that ceiling: index everything, pull back only the relevant bits
per question. And the mechanism is exactly the embedding idea from the start of the
talk — turn text into a vector, compare vectors — just applied to documents instead
of tokens. That's RAG. -->
<!-- IMPL NOTES: Explicit CALLBACK slide to slide 3 (embeddings). Visual: the WTE
lookup from slide 3 morphing into "document → vector". Note: embeddings here run
locally via transformers.js (all-MiniLM-L6-v2) — no embeddings API key. No demo
(concept bridge). -->

---

# #4 · RAG (vector retrieval)

```
corpus ─embed→ Qdrant      question ─embed→ nearest-neighbor → top-k → LLM → answer
```

Retrieval by **meaning**, not keywords.

<!-- TALKING POINTS: Embed the corpus into a vector store (Qdrant), embed the
question, grab the top-k most similar chunks, stuff only those into the prompt.
"The team that owns system-a" pulls back both the system-a doc and the Team Aurora
doc because they're semantically close. This is the workhorse of most production
"chat with your docs" systems. -->
<!-- IMPL NOTES: Source: graphrag/4-rag/README.md (reuse its diagram). Needs Qdrant
up (started in slide 6 setup). LIVE DEMO: `npm run 4:rag` — point at "Top matches"
with similarity scores, then the answer. Backup screenshot. First run downloads the
embedding model (~25MB) — pre-warm before the talk. -->

---

# RAG has many more knobs

we're using the simplest version — production RAG tunes:

- **Pre-processing & chunking** — chunk size, structure-aware splits, contextual chunks
- **Retrieval quality** — hybrid (BM25 + vector), reranking, metadata filters
- **Query transformation & eval** — rewriting, HyDE, multi-query; recall@k, faithfulness

<!-- TALKING POINTS: Quick breather — the RAG we just ran is the toy version. In
the real world there's a whole field of improvements: how you CHUNK and pre-process
docs, how you improve RETRIEVAL (combining keyword and vector search, re-ranking
results), how you TRANSFORM the query and EVALUATE quality. Each is a rabbit hole.
I'm flagging them so you know they exist — not going down them today. -->
<!-- IMPL NOTES: THE ONLY slide that covers these three categories — do NOT expand
them elsewhere. One line each, no demo. Visual: three labeled "knob" icons. Keep it
to ~30 seconds of talk. -->

---

# #5 · GraphRAG

When the answer depends on **relationships**, not text similarity.

```
question → match entity (system-a) → traverse ≤2 hops → subgraph → LLM → answer
(Maya Chen)—LEADS→(Team Aurora)—OWNS→(system-a {port:7654})
```

<!-- TALKING POINTS: Back to our two-hop question. Vector search finds similar
TEXT; it has no reliable way to make a JUMP — system-a, to its owning team, to who
leads that team. A graph does that by design: match the entity the question names,
then walk the relationships. The question only says "system-a," but traversal
discovers Team Aurora and Maya Chen two hops away. That's the thing RAG struggles
with. -->
<!-- IMPL NOTES: Source: graphrag/5-graphrag/README.md (reuse graph diagram). Needs
Neo4j up (slide 6 setup). LIVE DEMO: `npm run 5:graphrag` — point at "Matched seed:
system-a" and the 2-hop subgraph, then the answer. Optionally `npm run 5:browser`
to show the graph visually at localhost:7474. Backup screenshot. Callback: the
"two-hop question" from slide 6 finally pays off. -->

---

# #6 · MCP — the protocol layer

Knowledge behind a **live tool**, over a standard protocol.

```
client ──spawn/connect──► MCP server (tools)
   Claude ── tool-use loop ──► answer
```

MCP is *plumbing* — one client works with any server.

<!-- TALKING POINTS: A different axis. So far knowledge lived in files or a vector
DB. MCP is a standard PROTOCOL for exposing tools and data to a model — GitHub, a
database, your internal API. The point isn't a new retrieval trick; it's
standardization: the same client works against any MCP server. We run a tiny local
server that exposes our knowledge as tools, and Claude calls them. This sets up the
finale, where we combine it with RAG. -->
<!-- IMPL NOTES: Source: graphrag/6-mcp/README.md. LIVE DEMO: `npm run 6:mcp`
(client spawns the server automatically) — point at "Discovered MCP tools" then the
[mcp call] lines. Backup screenshot. Frame MCP as PROTOCOL not retrieval — it's the
odd one out, deliberately placed before #7. -->

---

# #7 · RAG + MCP

Index holds a **summary + a pointer**; MCP **fetches the deep doc** on demand.

```
question → RAG → "system-a … (see system-a.md)" → read_doc() → full runbook → answer
```

<!-- TALKING POINTS: Compose the last two. RAG is great at finding WHAT'S relevant
but you don't want to embed every giant runbook. So the index stores a short
summary plus a pointer to the deep doc; when the summary can't answer, the agent
follows the pointer and fetches the full doc over MCP. Small index, authoritative
detail on demand — this is how RAG and MCP actually fit together in production. -->
<!-- IMPL NOTES: Source: graphrag/7-rag-mcp/README.md. Needs Qdrant up. LIVE DEMO:
`npm run 7:rag-mcp` — ask the deploy/replicas question; point at "RAG retrieved …
→ system-a.md" then the [mcp call] read_doc, then the answer pulled from the
runbook. Backup screenshot. Callback: explicitly "this is #4 + #6". -->

---

# Where does the graph come from?

The demos **hand-wrote** the graph. Real life: you have **docs**.

→ build the graph from the docs, automatically.

<!-- TALKING POINTS: Everything so far was a teaching demo with a tiny, hand-built
graph. The honest question: in production, who writes the graph? You don't — you
have a pile of docs. So the last act is the real pipeline: turn existing docs into
a queryable knowledge graph, end to end. This lives in a separate repo,
graphrag-pipeline. -->
<!-- IMPL NOTES: Transition slide into Part 4. Contrast two icons: "hand-seeded
(demo)" vs "built from docs (real)". No demo. Mention this is a second repo
(graphrag-pipeline), all-Python. -->

---

# The pipeline

```
docs ─Firecrawl scrape→ markdown ─CAMEL + Claude→ graph ─normalize→ Neo4j ─→ graphrag query
```

self-hosted · offline-capable · one real flow

<!-- TALKING POINTS: Four stages. Scrape the docs with a self-hosted Firecrawl (no
cloud key, runs offline). Extract entities and relationships with CAMEL's
KnowledgeGraphAgent, driven by Claude. NORMALIZE the result (next slide — this is
the interesting part). Load into Neo4j. Then the exact graphrag query from #5 runs
over this real, built graph — no hand-seeding. -->
<!-- IMPL NOTES: Source: graphrag-pipeline/README.md (reuse its pipeline diagram).
LIVE DEMO (needs Firecrawl + Neo4j + docs site up — heaviest setup; pre-start and
rehearse): in graphrag-pipeline/ run `python build_graph.py` then `python query.py`
— point at extract counts, the normalized edges, and the final
"Maya Chen leads Team Aurora … port 7654" over the BUILT graph. Backup screenshot
strongly recommended (most failure-prone demo). -->

---

# The normalization lesson

LLM extraction nails the **facts**, fumbles the **schema**.

- `OWNS` vs `OWNEDBY` vs `OPERATEDBY` — direction & name drift
- `ENGINEEROF` one run, `ENGINEERAT` the next — non-deterministic
- duplicate nodes for one concept

→ normalizing to a canonical schema is the real **20%**.

<!-- TALKING POINTS: The punchline of the whole pipeline. Point an LLM at docs and
it extracts the right facts but an inconsistent SCHEMA: the same relationship comes
out named three different ways, pointing different directions, run to run. "Just
make a knowledge graph with an LLM" gets you 80% there; reconciling that into a
schema your queries can trust is the other 20% — and it's where the real
engineering is. That's exactly what normalize.py does. -->
<!-- IMPL NOTES: Source: graphrag-pipeline/normalize.py + README "what you'll
notice". Show a before→after: messy extracted edges → canonical edges. No live
demo (the build demo already showed normalized output); this slide explains WHY it
mattered. This is the talk's intellectual takeaway — give it room. -->

---

# Which technique when?

| Need | Reach for |
|---|---|
| Small / static knowledge | **Context stuffing** |
| Durable, editable, agent-navigable | **Memory (+ agentic)** |
| Large, changing corpus | **RAG** (+ chunking/rerank/eval) |
| Answers depend on relationships | **GraphRAG** |
| Knowledge behind an API/service | **MCP** |
| Teach *behavior/style* (not facts) | **Fine-tuning** |

<!-- TALKING POINTS: No single winner — match the technique to the shape of the
problem. Small and static? Just stuff it. Big and changing? RAG. Relationship
questions? Graph. Behind a live system? MCP. And if you need to change how the
model BEHAVES rather than what it knows — that's the fine-tuning half we set aside.
Most real systems combine several. -->
<!-- IMPL NOTES: Recap table — every row maps to a slide we showed (+ the
fine-tuning aside from slide 5). Keep terse. No demo. -->

---

# It all built on itself

**embeddings → in-prompt → retrieval → graph → protocol → real pipeline**

Try it:
- `graphrag/` — `npm install`, then `npm run 1:context … 7:rag-mcp`
- `graphrag-pipeline/` — `./setup.sh`, then `python build_graph.py && python query.py`

Go deeper: RAG knobs (chunking · hybrid · rerank · eval) · fine-tuning

<!-- TALKING POINTS: Trace the through-line one last time: we started with how a
model turns text into vectors, used that same idea for retrieval, added structure
with graphs, standardized access with MCP, and ended by building a graph from real
docs. Both repos are runnable — grab them and play. And the two doors we didn't
walk through — the RAG tuning toolbox and fine-tuning — are where to go next.
Thanks. -->
<!-- IMPL NOTES: Closing slide. Repeat the arc as a single line (mirror the title
slide's motif). Real, copy-pasteable entry points. End. No demo. -->
