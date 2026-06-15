import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CORPUS } from "../shared/knowledge";

/**
 * A tiny MCP server exposing the Helix knowledge base as tools over stdio.
 *
 * This is the "plumbing" half of MCP: a standard protocol any compatible client
 * can connect to. The client (client.ts) spawns this process, discovers these
 * tools, and lets Claude call them. The server itself knows nothing about Claude.
 */
const server = new McpServer({ name: "helix-knowledge", version: "1.0.0" });

server.registerTool(
  "list_services",
  {
    description: "List the titles of all documented Helix knowledge entries.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: CORPUS.map((d) => `- ${d.title}`).join("\n") }],
  }),
);

server.registerTool(
  "lookup_fact",
  {
    description: "Search the Helix internal knowledge base for entries matching a keyword.",
    inputSchema: {
      keyword: z.string().describe("Keyword to search for, e.g. 'Zephyr' or 'rate limit'"),
    },
  },
  async ({ keyword }) => {
    const k = keyword.toLowerCase();
    const hits = CORPUS.filter((d) =>
      `${d.title} ${d.text}`.toLowerCase().includes(k),
    );
    return {
      content: [
        {
          type: "text",
          text: hits.length
            ? hits.map((d) => `## ${d.title}\n${d.text}`).join("\n\n")
            : "No matching entries.",
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
