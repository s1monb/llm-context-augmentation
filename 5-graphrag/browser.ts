import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import neo4j from "neo4j-driver";

/**
 * Opens the Neo4j Browser so you can *see* the graph the demo builds.
 *
 * 1. Starts the Neo4j container (no-op if it's already up).
 * 2. Waits until Bolt accepts connections.
 * 3. Opens http://localhost:7474 in your browser, pre-filled with a Cypher
 *    query that renders the whole graph, plus the connection details so you
 *    don't have to type host/user/password.
 *
 * The demo only wipes the graph at the *start* of a run, so whatever you last
 * ran with `npm run 5:graphrag` is still there to browse.
 */
const here = dirname(fileURLToPath(import.meta.url));
const COMPOSE = join(here, "docker-compose.yml");

const BOLT = process.env.NEO4J_URL ?? "bolt://localhost:7687";
const PASSWORD = process.env.NEO4J_PASSWORD ?? "testpassword";
const HTTP = "http://localhost:7474";
const SHOW_ALL = "MATCH (n)-[r]->(m) RETURN n, r, m";

function startNeo4j(): void {
  console.log("Starting Neo4j (docker compose up -d)…");
  const r = spawnSync("docker", ["compose", "-f", COMPOSE, "up", "-d"], {
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error("Failed to start Neo4j. Is Docker running?");
  }
}

async function waitForBolt(timeoutMs = 60_000): Promise<void> {
  const driver = neo4j.driver(BOLT, neo4j.auth.basic("neo4j", PASSWORD));
  const deadline = Date.now() + timeoutMs;
  process.stdout.write("Waiting for Neo4j to accept connections");
  try {
    for (;;) {
      try {
        await driver.verifyConnectivity();
        process.stdout.write(" ready.\n");
        return;
      } catch {
        if (Date.now() > deadline) {
          throw new Error("\nNeo4j did not become ready in time.");
        }
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  } finally {
    await driver.close();
  }
}

function openBrowser(url: string): void {
  // Linux: xdg-open. macOS: open. Windows: start.
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(opener, args, { stdio: "ignore", detached: true });
  child.on("error", () => {
    console.log(`Could not auto-open a browser. Open this URL manually:\n  ${url}`);
  });
  child.unref();
}

async function main() {
  startNeo4j();
  await waitForBolt();

  // Neo4j Browser reads connection + an initial command from query params.
  const url =
    `${HTTP}/browser/?connectURL=` +
    encodeURIComponent(`neo4j://neo4j:${PASSWORD}@localhost:7687`) +
    `&cmd=edit&arg=${encodeURIComponent(SHOW_ALL)}`;

  console.log("\nOpening Neo4j Browser…");
  console.log(`  URL:      ${HTTP}`);
  console.log(`  Login:    neo4j / ${PASSWORD}`);
  console.log(`  Then run: ${SHOW_ALL}`);
  openBrowser(url);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
