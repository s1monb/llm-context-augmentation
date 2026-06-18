import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ask } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 2 — Persistent memory (markdown hierarchy).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const MEM = path.join(here, "memory");

async function readAllMarkdown(
  dir: string,
): Promise<{ rel: string; text: string }[]> {
  const out: { rel: string; text: string }[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await readAllMarkdown(full)));
    } else if (entry.name.endsWith(".md")) {
      out.push({ rel: path.relative(MEM, full), text: await fs.readFile(full, "utf8") });
    }
  }
  return out;
}

async function main() {
  console.log(`${c.bold}Variant 2 — Persistent memory${c.reset}`);
  note("Load an on-disk markdown tree, dump it all into the prompt, ask once.");
  console.log(`\n${c.magenta}Q:${c.reset} ${QUESTION}`);

  // ⏸ Pause before touching the disk so the store can be introduced.
  await pause("Press Enter to load the markdown memory tree from disk…");

  // STEP 1 — Read the whole persistent store off disk.
  step("Read the markdown memory tree from disk");
  note(`Memory store: ${path.relative(process.cwd(), MEM)}/`);
  const files = await readAllMarkdown(MEM);
  console.log(`Loaded ${files.length} markdown files:`);
  for (const f of files) console.log(`  ${c.green}•${c.reset} ${f.rel}`);

  // ⏸ Pause so the file list can be talked through before we stuff it.
  await pause("Press Enter to concatenate every file into the prompt…");

  // STEP 2 — Concatenate every file, verbatim, into a single prompt.
  step("Concatenate all files into the prompt");
  note("No retrieval — the entire store goes in, same as context stuffing:");
  const context = files.map((f) => `# FILE: ${f.rel}\n${f.text}`).join("\n\n");
  const prompt = `${context}\n\n---\nQuestion: ${QUESTION}`;
  console.log(`\n${c.dim}--- assembled prompt (${prompt.length} chars) ---${c.reset}`);
  console.log(`${c.dim}${prompt}${c.reset}`);

  // ⏸ Pause before sending the stuffed prompt to the model.
  await pause("Press Enter to send the stuffed prompt to the model…");

  // STEP 3 — One LLM call with the entire prompt.
  step("Single LLM call with the entire prompt");
  const answer = await ask({
    system:
      "You have access to the user's persistent markdown memory. Answer the question using only what's in those files.",
    prompt,
  });
  console.log(`${c.green}${c.bold}Answer:${c.reset} ${answer}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
