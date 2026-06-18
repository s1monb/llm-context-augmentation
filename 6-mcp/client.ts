import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { client as anthropic, MODEL } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 4 — MCP.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

/** One-line dimmed preview of a tool result, so the loop output stays readable. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

async function main() {
  console.log(`${c.bold}Variant 4 — MCP${c.reset}`);
  note("Spawn an MCP server, discover its tools, run a normal tool-use loop.");
  console.log(`\n${c.magenta}Q:${c.reset} ${QUESTION}`);

  // ⏸ Pause before spawning the server.
  await pause("Press Enter to spawn the MCP server and discover its tools…");

  // STEP 1 — Spawn and connect to the MCP server over stdio, then discover tools.
  step("Spawn the MCP server and discover its tools");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", path.join(here, "server.ts")],
  });
  const mcp = new Client({ name: "helix-client", version: "1.0.0" });
  await mcp.connect(transport);

  const { tools: mcpTools } = await mcp.listTools();
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
  note("Tools advertised by the server (handed to Claude verbatim):");
  for (const t of tools) console.log(`  ${c.green}•${c.reset} ${t.name} — ${c.dim}${t.description}${c.reset}`);

  // ⏸ Pause before the loop.
  await pause("Press Enter to start the tool-use loop…");

  // STEP 2 — Standard tool-use loop — but every tool call is routed to MCP.
  step("Tool-use loop — calls routed to the MCP server");
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];
  let round = 0;

  while (true) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: "Answer using the Helix knowledge tools exposed over MCP.",
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
      step("The model answers");
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
