import path from "node:path";
import { fileURLToPath } from "node:url";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { embed, EMBED_DIM } from "../shared/embeddings";
import { client as anthropic, MODEL } from "../shared/claude";
import { CORPUS, DOC_QUESTION } from "../shared/knowledge";

/**
 * Variant 7 — RAG + MCP.
 *
 * Combines the two: RAG holds cheap summaries plus a *pointer* to a deeper doc
 * (the `doc` field, stored in the Qdrant payload), and MCP serves those docs on
 * demand. The flow:
 *
 *   1. Retrieve summaries by similarity (RAG) — these reference docs by filename.
 *   2. Hand the agent a `read_doc` tool (MCP).
 *   3. The summary alone can't answer DOC_QUESTION, so the agent follows the
 *      pointer and fetches the runbook — only then is the heavy content loaded.
 *
 * This is the common production shape: index is small and semantic; the bulky
 * source of truth is fetched lazily, only for the docs that turned out relevant.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = "helix-docs";

async function main() {
  console.log(`Q: ${DOC_QUESTION}\n`);

  // --- RAG: index the summaries (with doc pointers) and retrieve ---
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
  });
  await qdrant.deleteCollection(COLLECTION).catch(() => {});
  await qdrant.createCollection(COLLECTION, {
    vectors: { size: EMBED_DIM, distance: "Cosine" },
  });
  const vectors = await embed(CORPUS.map((d) => `${d.title}. ${d.text}`));
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: CORPUS.map((d, i) => ({
      id: i,
      vector: vectors[i],
      // The doc pointer is stored IN the RAG payload — that's the link.
      payload: { title: d.title, text: d.text, doc: d.doc ?? null },
    })),
  });

  const [queryVector] = await embed([DOC_QUESTION]);
  const hits = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 3,
    with_payload: true,
  });
  console.log(
    "RAG retrieved: " +
      hits
        .map((h) => `${h.payload?.title}${h.payload?.doc ? ` → ${h.payload.doc}` : ""}`)
        .join(", ") +
      "\n",
  );

  const passages = hits
    .map((h) => {
      const ref = h.payload?.doc
        ? `\n(Deeper technical doc available: ${h.payload.doc})`
        : "";
      return `## ${h.payload?.title}\n${h.payload?.text}${ref}`;
    })
    .join("\n\n");

  // --- MCP: connect to the docs server that can serve those referenced docs ---
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join(here, "docs-server.ts")],
  });
  const mcp = new Client({ name: "rag-mcp-client", version: "1.0.0" });
  await mcp.connect(transport);
  const { tools: mcpTools } = await mcp.listTools();
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  // --- Agentic loop: RAG context in the prompt, MCP tool to follow the pointer ---
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Retrieved knowledge (summaries; some reference deeper technical docs by filename):\n\n${passages}\n\n---\nQuestion: ${DOC_QUESTION}`,
    },
  ];

  while (true) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "Answer the question. The retrieved summaries may reference deeper technical docs by filename. If a summary doesn't contain the answer, call read_doc to open the referenced doc, then answer.",
      tools,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      console.log("--- Answer ---");
      console.log(
        res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
      );
      break;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      console.log(`[mcp call] ${block.name}(${JSON.stringify(block.input)})`);
      const r = await mcp.callTool({
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });
      const text = (r.content as { type: string; text?: string }[])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      results.push({ type: "tool_result", tool_use_id: block.id, content: text });
    }
    messages.push({ role: "user", content: results });
  }

  await mcp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
