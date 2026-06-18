import { QdrantClient } from "@qdrant/js-client-rest";
import { embed, EMBED_DIM } from "../shared/embeddings";
import { ask } from "../shared/claude";
import { CORPUS, QUESTION } from "../shared/knowledge";
import { c, step, note, pause } from "../shared/ui";

/**
 * Variant 5 — RAG (vector retrieval).
 */
const COLLECTION = "helix";

async function main() {
  console.log(`${c.bold}Variant 5 — RAG (vector retrieval)${c.reset}`);
  note("Index the corpus as vectors, retrieve by meaning, stuff only the matches.");
  console.log(`\n${c.magenta}Q:${c.reset} ${QUESTION}`);

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
  });

  // ⏸ Pause before building the index.
  await pause("Press Enter to embed and index the corpus…");

  // STEP 1 — Embed every doc and upsert it into the vector store.
  step("Embed the corpus and index it in Qdrant");
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
      payload: { title: d.title, text: d.text },
    })),
  });
  note(`Indexed ${CORPUS.length} docs as ${EMBED_DIM}-dim vectors:`);
  for (const d of CORPUS) console.log(`  ${c.green}•${c.reset} ${d.title}`);

  // ⏸ Pause before embedding the query.
  await pause("Press Enter to embed the question…");

  // STEP 2 — Embed the question into the same vector space.
  step("Embed the question");
  const [queryVector] = await embed([QUESTION]);
  note(`Question → ${EMBED_DIM}-dim vector  [${queryVector.slice(0, 4).map((n) => n.toFixed(3)).join(", ")}, …]`);

  // ⏸ Pause before searching.
  await pause("Press Enter to search the vector store…");

  // STEP 3 — Retrieve the most semantically similar passages.
  step("Vector search — top matches by similarity");
  const hits = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 3,
    with_payload: true,
  });
  for (const h of hits) {
    console.log(`  ${c.green}•${c.reset} ${h.payload?.title} ${c.dim}(score ${h.score.toFixed(3)})${c.reset}`);
  }

  // ⏸ Pause before assembling the prompt.
  await pause("Press Enter to append the matches to the prompt…");

  // STEP 4 — Stuff ONLY the retrieved passages into the prompt.
  step("Append only the retrieved passages to the prompt");
  const context = hits
    .map((h) => `## ${h.payload?.title}\n${h.payload?.text}`)
    .join("\n\n");
  const prompt = `Retrieved passages:\n\n${context}\n\n---\nQuestion: ${QUESTION}`;
  console.log(`\n${c.dim}--- assembled prompt (${prompt.length} chars) ---${c.reset}`);
  console.log(`${c.dim}${prompt}${c.reset}`);

  // ⏸ Pause before the call.
  await pause("Press Enter to send the prompt to the model…");

  // STEP 5 — One LLM call over the retrieved context.
  step("Single LLM call with the retrieved context");
  const answer = await ask({
    system: "Answer using ONLY the retrieved passages below.",
    prompt,
  });
  console.log(`${c.green}${c.bold}Answer:${c.reset} ${answer}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
