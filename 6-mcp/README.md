# 6 · MCP (Model Context Protocol)

> A standard protocol for connecting a model to tools and data. MCP is the *plumbing*; the knowledge technique it enables here is live tool-based lookup.

## What it does

- [`server.ts`](server.ts) — a tiny **MCP server** (stdio) exposing the Helix
  knowledge base as two tools: `list_services` and `lookup_fact`.
- [`client.ts`](client.ts) — spawns that server, **discovers** its tools, hands
  them to Claude, and runs a tool-use loop.

The model calls `lookup_fact("system-a")` / `lookup_fact("Team Aurora")` and answers.

## Mechanism

```
client ──spawn──► MCP server (stdio)
   │                  ▲
   │   listTools()    │ callTool()
   ▼                  │
 Claude ── tool-use loop ──► answer
```

The point: the client is **server-agnostic**. Point it at a different MCP server
(GitHub, Postgres, a filesystem) and the client code doesn't change — that's the
standardization MCP buys you.

## Run

```bash
npm run 6:mcp
```

`client.ts` spawns `server.ts` automatically via `npx tsx` — no separate step.

## Trade-offs

| 👍 | 👎 |
|----|----|
| One client works with any MCP server | More moving parts than a plain prompt |
| Live data, not a pre-built index | Latency of a tool-use loop |
| Decouples knowledge source from the app | Server must be running/spawnable |

**Use when:** the knowledge lives behind an API/DB/service, or you want a reusable, swappable integration layer.
