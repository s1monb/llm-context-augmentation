import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { client as anthropic, MODEL } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";

/**
 * Variant 4 — MCP.
 *
 * MCP is a *protocol*, not a knowledge technique in itself: it's a standard way
 * to connect a model to tools and data. Here we spawn the local stdio MCP
 * server (server.ts), discover whatever tools it advertises, hand those tools
 * to Claude verbatim, and run a normal tool-use loop. Swapping the server for a
 * different one (GitHub, a database, the filesystem) needs zero client changes.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log(`Q: ${QUESTION}\n`);

  // 1. Spawn and connect to the MCP server over stdio.
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join(here, "server.ts")],
  });
  const mcp = new Client({ name: "helix-client", version: "1.0.0" });
  await mcp.connect(transport);

  // 2. Discover the server's tools and translate them to Anthropic tool specs.
  const { tools: mcpTools } = await mcp.listTools();
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
  console.log(`Discovered MCP tools: ${tools.map((t) => t.name).join(", ")}\n`);

  // 3. Standard tool-use loop — but every tool call is routed to the MCP server.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];
  while (true) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: "Answer using the Helix knowledge tools exposed over MCP.",
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
