import { QdrantClient } from "@qdrant/js-client-rest";
import { embed, EMBED_DIM } from "../shared/embeddings";
import { ask } from "../shared/claude";
import { CORPUS, QUESTION } from "../shared/knowledge";

/**
 * Variant 5 — RAG (vector retrieval).
 *
 * Embed the corpus into a vector store (Qdrant), embed the question, retrieve
 * the most *semantically similar* passages, and stuff only those into the
 * prompt. Retrieval is by meaning, not keyword.
 */
const COLLECTION = "helix";

async function main() {
  console.log(`Q: ${QUESTION}\n`);

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://localhost:6333",
  });

  // 1. (Re)create the collection.
  await qdrant.deleteCollection(COLLECTION).catch(() => {});
  await qdrant.createCollection(COLLECTION, {
    vectors: { size: EMBED_DIM, distance: "Cosine" },
  });

  // 2. Embed the corpus locally and upsert.
  const vectors = await embed(CORPUS.map((d) => `${d.title}. ${d.text}`));
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: CORPUS.map((d, i) => ({
      id: i,
      vector: vectors[i],
      payload: { title: d.title, text: d.text },
    })),
  });
  console.log(`Indexed ${CORPUS.length} docs into Qdrant.\n`);

  // 3. Embed the question and retrieve the top matches.
  const [queryVector] = await embed([QUESTION]);
  const hits = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 3,
    with_payload: true,
  });
  console.log(
    "Top matches: " +
      hits.map((h) => `${h.payload?.title} (${h.score.toFixed(3)})`).join(", ") +
      "\n",
  );

  // 4. Stuff ONLY the retrieved passages into the prompt.
  const context = hits
    .map((h) => `## ${h.payload?.title}\n${h.payload?.text}`)
    .join("\n\n");
  const answer = await ask({
    system: "Answer using ONLY the retrieved passages below.",
    prompt: `Retrieved passages:\n\n${context}\n\n---\nQuestion: ${QUESTION}`,
  });
  console.log("--- Answer ---");
  console.log(answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
