import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 3 — Agentic retrieval over persistent memory.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
// Reuse variant 2's memory tree — same store, different access pattern.
const MEM = path.resolve(here, "..", "2-persistent-memory", "memory");

async function listMemoryFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".md")) out.push(path.relative(MEM, full));
    }
  }
  await walk(MEM);
  return out;
}

async function readMemoryFile(rel: string): Promise<string> {
  const full = path.resolve(MEM, rel);
  if (full !== MEM && !full.startsWith(MEM + path.sep)) {
    throw new Error(`Refusing to read outside memory store: ${rel}`);
  }
  return fs.readFile(full, "utf8");
}

const tools: Anthropic.Tool[] = [
  {
    name: "list_memory_files",
    description: "List every markdown file in the persistent memory store (relative paths). Start here.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "read_memory_file",
    description: "Read the full contents of one memory file by its relative path.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path, e.g. services/zephyr.md" },
      },
      required: ["path"],
    },
  },
];

async function runTool(name: string, input: any): Promise<string> {
  if (name === "list_memory_files") return (await listMemoryFiles()).join("\n");
  if (name === "read_memory_file") return readMemoryFile(input.path);
  return `Unknown tool: ${name}`;
}

/** One-line dimmed preview of a tool result, so the loop output stays readable. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

async function main() {
  console.log(`${c.bold}Variant 3 — Agentic memory${c.reset}`);
  note("Give the model tools to navigate memory; it reads only what it needs.");
  console.log(`\n${c.magenta}Q:${c.reset} ${QUESTION}`);

  // ⏸ Pause before introducing the tools.
  await pause("Press Enter to hand the model its memory tools…");

  // STEP 1 — Give the model navigation tools instead of the whole store.
  step("Hand the model tools to navigate memory");
  note("No store is stuffed in — the model gets two tools and must choose:");
  for (const t of tools) console.log(`  ${c.green}•${c.reset} ${t.name} — ${c.dim}${t.description}${c.reset}`);

  // ⏸ Pause before kicking off the loop.
  await pause("Press Enter to start the agentic retrieval loop…");

  // STEP 2 — Agentic loop. The model lists, then reads only what it needs.
  step("Agentic retrieval loop — the model drives");
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];
  let round = 0;

  while (true) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "Answer the user's question. You have a persistent markdown memory; use the tools to discover and read only the files you actually need before answering.",
      tools,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    // Show any reasoning the model emitted alongside its tool calls.
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) console.log(`${c.dim}model: ${text}${c.reset}`);

    // No more tools requested → the model is ready to answer.
    if (res.stop_reason !== "tool_use") {
      await pause("Press Enter to reveal the final answer…");
      step("The model answers from what it chose to read");
      console.log(`${c.green}${c.bold}Answer:${c.reset} ${text}`);
      break;
    }

    // Surface what the model wants to call this round, then gate execution.
    round++;
    const calls = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    for (const call of calls) {
      console.log(`${c.yellow}↳ round ${round}:${c.reset} ${call.name}(${JSON.stringify(call.input)})`);
    }
    await pause(`Press Enter to run round ${round}'s tool call(s)…`);

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const out = await runTool(call.name, call.input);
      console.log(`  ${c.green}✓${c.reset} ${c.dim}${preview(out)}${c.reset}`);
      results.push({ type: "tool_result", tool_use_id: call.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
