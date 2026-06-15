import "dotenv/config";
import neo4j from "neo4j-driver";
import { ask } from "../shared/claude";
import { QUESTION } from "../shared/knowledge";

/**
 * Variant 6 — GraphRAG (graph retrieval).
 *
 * Knowledge is a graph of entities (systems, teams, people, policies) and the
 * relationships between them. Retrieval = match the entities the question names,
 * then *traverse* outward to pull in connected context. This is what makes it
 * shine here: the question only names "system-a", but the answer (who leads the
 * owning team) is two hops away — system-a → Team Aurora → Maya Chen. Vector
 * similarity wouldn't reliably make that jump; graph traversal does it by design.
 */
const URL = process.env.NEO4J_URL ?? "bolt://localhost:7687";
const PASSWORD = process.env.NEO4J_PASSWORD ?? "testpassword";

const SEED_GRAPH = `
CREATE (sa:System {name:'system-a', port:7654, description:'real-time event-streaming service'})
CREATE (sb:System {name:'system-b', port:9310, description:'distributed cache service'})
CREATE (aurora:Team {name:'Team Aurora'})
CREATE (borealis:Team {name:'Team Borealis'})
CREATE (maya:Person {name:'Maya Chen', role:'Team Lead'})
CREATE (liam:Person {name:'Liam Park', role:'Engineer'})
CREATE (sofia:Person {name:'Sofia Rossi', role:'Engineer'})
CREATE (noah:Person {name:'Noah Kim', role:'Team Lead'})
CREATE (ava:Person {name:'Ava Singh', role:'Engineer'})
CREATE (omar:Person {name:'Omar Haddad', role:'Engineer'})
CREATE (rl:Policy {name:'Helix Public API Rate Limit', value:'7 requests per second per API key'})
CREATE (aurora)-[:OWNS]->(sa)
CREATE (borealis)-[:OWNS]->(sb)
CREATE (maya)-[:LEADS]->(aurora)
CREATE (liam)-[:MEMBER_OF]->(aurora)
CREATE (sofia)-[:MEMBER_OF]->(aurora)
CREATE (noah)-[:LEADS]->(borealis)
CREATE (ava)-[:MEMBER_OF]->(borealis)
CREATE (omar)-[:MEMBER_OF]->(borealis)
CREATE (sa)-[:GOVERNED_BY]->(rl)
CREATE (sb)-[:GOVERNED_BY]->(rl)
`;

// Generic words that shouldn't anchor an entity match (so "team"/"system"/"port"
// in the question don't seed every Team/System node). The distinctive tokens —
// "system-a", "aurora", "maya" — still match.
const STOPWORDS = new Set([
  "the", "that", "and", "what", "who", "does", "with", "for", "team",
  "system", "service", "policy", "port", "listen", "owns", "leads",
  "helix", "public", "api", "rate", "limit",
]);

/** Naive entity linking: a node is a seed if a distinctive word of its name appears in the question. */
function matchSeeds(question: string, names: string[]): string[] {
  const q = question.toLowerCase();
  return names.filter((name) =>
    name
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.length > 2 && !STOPWORDS.has(word) && q.includes(word)),
  );
}

function nodeStr(name: string, label: string, props: Record<string, unknown>): string {
  const extra = Object.entries(props)
    .filter(([k]) => k !== "name")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return extra ? `${name} [${label}] {${extra}}` : `${name} [${label}]`;
}

async function main() {
  console.log(`Q: ${QUESTION}\n`);

  // disableLosslessIntegers → ports come back as plain JS numbers, not {low,high}.
  const driver = neo4j.driver(URL, neo4j.auth.basic("neo4j", PASSWORD), {
    disableLosslessIntegers: true,
  });
  const session = driver.session();

  try {
    // 1. Build the graph fresh.
    await session.run("MATCH (n) DETACH DELETE n");
    await session.run(SEED_GRAPH);

    // 2. Entity-link the question against node names.
    const allNames = (await session.run("MATCH (n) RETURN n.name AS name")).records.map(
      (r) => r.get("name") as string,
    );
    const seeds = matchSeeds(QUESTION, allNames);
    console.log(`Matched seed entities: ${seeds.join(", ") || "(none)"}\n`);

    // 3. Traverse up to 2 hops from each seed and collect the directed edges.
    const result = await session.run(
      `MATCH path = (seed)-[*1..2]-(x)
       WHERE seed.name IN $seeds
       UNWIND relationships(path) AS r
       RETURN DISTINCT
         startNode(r).name AS fromName, labels(startNode(r))[0] AS fromLabel, properties(startNode(r)) AS fromProps,
         type(r) AS rel,
         endNode(r).name AS toName, labels(endNode(r))[0] AS toLabel, properties(endNode(r)) AS toProps`,
      { seeds },
    );

    const edges = new Set<string>();
    for (const rec of result.records) {
      const from = nodeStr(rec.get("fromName"), rec.get("fromLabel"), rec.get("fromProps"));
      const to = nodeStr(rec.get("toName"), rec.get("toLabel"), rec.get("toProps"));
      edges.add(`${from}  —${rec.get("rel")}→  ${to}`);
    }

    const context = [...edges].join("\n");
    console.log("--- Retrieved subgraph (2-hop edges) ---");
    console.log(context + "\n");

    // 4. Answer from the subgraph.
    const answer = await ask({
      system:
        "Answer using ONLY the knowledge-graph triples below (entities matched to the question, expanded up to two hops).",
      prompt: `Knowledge-graph context:\n\n${context}\n\n---\nQuestion: ${QUESTION}`,
    });
    console.log("--- Answer ---");
    console.log(answer);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
