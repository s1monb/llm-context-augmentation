import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ask } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";

/**
 * Variant 2 — Persistent memory (markdown hierarchy).
 *
 * Knowledge lives in a structured, on-disk markdown tree (memory/) with an
 * index file. Unlike context stuffing's ad-hoc blob, this store *persists*
 * across runs and is human-editable. Here we load the whole hierarchy and
 * inject it; variant 3 keeps the same store but lets the agent fetch only the
 * files it needs.
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
  console.log(`Q: ${QUESTION}\n`);

  const files = await readAllMarkdown(MEM);
  console.log(`Loaded ${files.length} markdown memory files:`);
  console.log(files.map((f) => `  ${f.rel}`).join("\n") + "\n");

  const context = files
    .map((f) => `# FILE: ${f.rel}\n${f.text}`)
    .join("\n\n");

  const answer = await ask({
    system:
      "You have access to the user's persistent markdown memory. Answer the question using only what's in those files.",
    prompt: `${context}\n\n---\nQuestion: ${QUESTION}`,
  });
  console.log("--- Answer ---");
  console.log(answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
