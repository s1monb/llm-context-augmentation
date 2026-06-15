import { ask } from "../shared/claude";
import { CORPUS, QUESTION } from "../shared/knowledge";

/**
 * Variant 1 — Context stuffing.
 *
 * The simplest possible injection: paste the entire knowledge base into the
 * prompt and ask. No retrieval, no infrastructure, no weight changes. Knowledge
 * lives entirely in the request and is thrown away after the response.
 */
async function main() {
  console.log(`Q: ${QUESTION}\n`);

  // 1. Baseline — model has never seen these facts.
  const baseline = await ask({ prompt: QUESTION });
  console.log("--- Baseline (no context) ---");
  console.log(baseline + "\n");

  // 2. Stuff the WHOLE corpus into the prompt.
  const context = CORPUS.map((d) => `## ${d.title}\n${d.text}`).join("\n\n");
  const stuffed = await ask({
    system:
      "Answer using ONLY the reference material provided. If the answer isn't there, say you don't know.",
    prompt: `Reference material:\n\n${context}\n\n---\nQuestion: ${QUESTION}`,
  });
  console.log("--- With full context stuffed ---");
  console.log(stuffed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
