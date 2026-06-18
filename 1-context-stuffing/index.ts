import { ask } from "../shared/claude";
import { CORPUS, QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 1 — Context stuffing.
 */

// --- the demo ----------------------------------------------------------------
async function main() {
  console.log(`${c.bold}Variant 1 — Context stuffing${c.reset}`);
  note("Paste the whole knowledge base into the prompt, then make one call.");
  console.log(`\n${c.magenta}Q:${c.reset} ${QUESTION}`);

  // ⏸ Pause before the first call so the question can be read out.
  await pause("Press Enter to ask the model with no context…");

  // STEP 1 — Baseline. The model has never seen these facts.
  step("Baseline — ask with no context");
  note("The model has never seen the Helix knowledge base, so it should refuse.");
  const baseline = await ask({ prompt: QUESTION });
  console.log(baseline);

  // ⏸ Pause so the refusal can land before we stuff the corpus in.
  await pause("Press Enter to stuff the full knowledge base into the prompt…");

  // STEP 2 — Assemble every doc, verbatim, into a single prompt.
  step("Assemble the full corpus into the prompt");
  note(`Stuffing all ${CORPUS.length} docs — no retrieval, no filtering:`);
  for (const d of CORPUS) console.log(`  ${c.green}•${c.reset} ${d.title}`);

  const context = CORPUS.map((d) => `## ${d.title}\n${d.text}`).join("\n\n");
  const prompt = `Reference material:\n\n${context}\n\n---\nQuestion: ${QUESTION}`;

  console.log(`\n${c.dim}--- assembled prompt (${prompt.length} chars) ---${c.reset}`);
  console.log(`${c.dim}${prompt}${c.reset}`);

  // ⏸ Pause so the presenter can talk through the stuffed prompt before sending.
  await pause("Press Enter to send the stuffed prompt to the model…");

  // STEP 3 — One LLM call with the entire prompt.
  step("Single LLM call with the entire prompt");
  const stuffed = await ask({
    system:
      "Answer using ONLY the reference material provided. If the answer isn't there, say you don't know.",
    prompt,
  });
  console.log(`${c.green}${c.bold}Answer:${c.reset} ${stuffed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
