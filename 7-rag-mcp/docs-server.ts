import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP server exposing the deep technical docs (runbooks) as on-demand reads.
 *
 * The RAG index only stores short summaries plus a *pointer* to one of these
 * files. When the summary can't answer the question, the agent fetches the full
 * doc through this server — so the heavy content never has to be embedded or
 * sit in the context window unless it's actually needed.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(here, "docs");

const server = new McpServer({ name: "helix-docs", version: "1.0.0" });

server.registerTool(
  "list_docs",
  { description: "List the available deep technical doc filenames.", inputSchema: {} },
  async () => ({
    content: [
      {
        type: "text",
        text: (await fs.readdir(DOCS)).filter((f) => f.endsWith(".md")).join("\n"),
      },
    ],
  }),
);

server.registerTool(
  "read_doc",
  {
    description: "Read a Helix technical doc (runbook) by filename, e.g. 'system-a.md'.",
    inputSchema: { filename: z.string().describe("Doc filename, e.g. system-a.md") },
  },
  async ({ filename }) => {
    const full = path.resolve(DOCS, filename);
    if (full !== DOCS && !full.startsWith(DOCS + path.sep)) {
      return { content: [{ type: "text", text: "Refused: path outside docs/." }], isError: true };
    }
    try {
      return { content: [{ type: "text", text: await fs.readFile(full, "utf8") }] };
    } catch {
      return { content: [{ type: "text", text: `Not found: ${filename}` }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
