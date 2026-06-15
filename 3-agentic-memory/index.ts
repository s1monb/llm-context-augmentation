import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";

/**
 * Variant 3 — Agentic retrieval over persistent memory.
 *
 * Same markdown store as variant 2, but instead of dumping everything into the
 * prompt, the model is given tools to *navigate* the memory: list the files,
 * then read only the ones it judges relevant. The agent drives retrieval.
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

async function main() {
  console.log(`Q: ${QUESTION}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

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
      console.log(`[tool] ${block.name}(${JSON.stringify(block.input)})`);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: await runTool(block.name, block.input),
      });
    }
    messages.push({ role: "user", content: results });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
