# 5 · GraphRAG (graph retrieval)

> Model knowledge as a graph of entities and relationships. Retrieve by matching entities, then *traversing* their connections.

## What it does

1. Builds a small graph in **Neo4j**: `System`, `Team`, `Person`, and `Policy`
   nodes joined by relationships (`OWNS`, `LEADS`, `MEMBER_OF`, `GOVERNED_BY`).
2. Entity-links the question against node names → the only seed is `system-a`.
3. Traverses **up to two hops** from the seed to pull in connected context.
4. Answers from that subgraph.

```
(Maya Chen:Person) ─LEADS─► (Team Aurora:Team) ─OWNS─► (system-a:System {port:7654})
(Liam Park) ─MEMBER_OF─► (Team Aurora)                       │
(Sofia Rossi) ─MEMBER_OF─► (Team Aurora)                     └─GOVERNED_BY─► (Rate Limit)
```

## Mechanism

```
question ──entity-link──► seed (system-a) ──2-hop traversal──► subgraph ──► LLM ──► answer
```

The payoff: the question only **names** `system-a`, but the answer (who leads the
owning team) is **two hops away** — `system-a → Team Aurora → Maya Chen`. Graph
traversal makes that jump by following relationships; vector similarity has no
reliable way to. That's the difference from #4 (vector RAG).

## Run

```bash
# 1. start Neo4j
docker compose -f 5-graphrag/docker-compose.yml up -d

# 2. run the demo  (Neo4j takes a few seconds to accept connections)
npm run 5:graphrag
```

## See the graph

```bash
# starts Neo4j if needed, waits for it, then opens the browser pre-filled to
# visualize the whole graph (login: neo4j / testpassword)
npm run 5:browser
```

This opens <http://localhost:7474>. Once connected, run
`MATCH (n)-[r]->(m) RETURN n, r, m` to render every node and edge. The demo only
wipes the graph at the *start* of a run, so the last `npm run 5:graphrag` is
still there to browse. Stop Neo4j with `npm run 5:down` when you're done.

## Trade-offs

| 👍 | 👎 |
|----|----|
| Captures relationships, multi-hop joins | Needs a graph + an entity/relationship model |
| Retrieves *connected* context, not just similar text | Building the graph from raw docs is the hard part (not shown here) |
| Explainable traversal paths | More infrastructure than vector RAG |

**Use when:** answers depend on how facts *relate* (dependencies, org charts, provenance) rather than on isolated passages.
