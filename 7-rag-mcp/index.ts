import path from "node:path";
import { fileURLToPath } from "node:url";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { embed, EMBED_DIM } from "../shared/embeddings";
import { client as anthropic, MODEL } from "../shared/claude";
import { CORPUS, DOC_QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 7 — RAG + MCP.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION = "helix-docs";

/** One-line dimmed preview of a tool result, so the loop output stays readable. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

async function main() {
  console.log(`${c.bold}Variant 7 — RAG + MCP${c.reset}`);
  note("RAG holds summaries with doc pointers; MCP fetches the heavy doc on demand.");
  console.log(`\n${c.magenta}Q:${c.reset} ${DOC_QUESTION}`);

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
  });

  // ⏸ Pause before indexing.
  await pause("Press Enter to index the summaries (with doc pointers)…");

  // STEP 1 — RAG: index the summaries, each carrying a pointer to a deeper doc.
  step("RAG — index the summaries (with doc pointers)");
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
  note(`Indexed ${CORPUS.length} summaries; some carry a pointer to a deeper runbook.`);

  // ⏸ Pause before retrieval.
  await pause("Press Enter to retrieve the summaries by similarity…");

  // STEP 2 — RAG: retrieve the most similar summaries.
  step("RAG — retrieve summaries by similarity");
  const [queryVector] = await embed([DOC_QUESTION]);
  const hits = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 3,
    with_payload: true,
  });
  for (const h of hits) {
    const ref = h.payload?.doc ? ` ${c.yellow}→ ${h.payload.doc}${c.reset}` : "";
    console.log(`  ${c.green}•${c.reset} ${h.payload?.title} ${c.dim}(${h.score.toFixed(3)})${c.reset}${ref}`);
  }

  const passages = hits
    .map((h) => {
      const ref = h.payload?.doc
        ? `\n(Deeper technical doc available: ${h.payload.doc})`
        : "";
      return `## ${h.payload?.title}\n${h.payload?.text}${ref}`;
    })
    .join("\n\n");

  // ⏸ Pause before wiring up MCP.
  await pause("Press Enter to connect the docs server over MCP…");

  // STEP 3 — MCP: connect the docs server that can serve those referenced docs.
  step("MCP — connect the docs server and discover its tools");
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
  note("Tools advertised by the docs server:");
  for (const t of tools) console.log(`  ${c.green}•${c.reset} ${t.name} — ${c.dim}${t.description}${c.reset}`);

  // ⏸ Pause before the loop.
  await pause("Press Enter to start the agent loop…");

  // STEP 4 — Agentic loop: RAG context in the prompt, MCP tool to follow the pointer.
  step("Agent loop — RAG context in, MCP tool to follow the pointer");
  note("The summary alone can't answer this, so the agent should call read_doc.");
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Retrieved knowledge (summaries; some reference deeper technical docs by filename):\n\n${passages}\n\n---\nQuestion: ${DOC_QUESTION}`,
    },
  ];
  let round = 0;

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

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) console.log(`${c.dim}model: ${text}${c.reset}`);

    if (res.stop_reason !== "tool_use") {
      await pause("Press Enter to reveal the final answer…");
      step("The model answers from the fetched runbook");
      console.log(`${c.green}${c.bold}Answer:${c.reset} ${text}`);
      break;
    }

    round++;
    const calls = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    for (const call of calls) {
      console.log(`${c.yellow}↳ round ${round}:${c.reset} ${call.name}(${JSON.stringify(call.input)})`);
    }
    await pause(`Press Enter to run round ${round}'s MCP call(s)…`);

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const r = await mcp.callTool({
        name: call.name,
        arguments: call.input as Record<string, unknown>,
      });
      const out = (r.content as { type: string; text?: string }[])
        .filter((cc) => cc.type === "text")
        .map((cc) => cc.text)
        .join("\n");
      console.log(`  ${c.green}✓${c.reset} ${c.dim}${preview(out)}${c.reset}`);
      results.push({ type: "tool_result", tool_use_id: call.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  await mcp.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
