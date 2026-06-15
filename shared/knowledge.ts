/**
 * A tiny fictional knowledge base about the "Helix" platform.
 *
 * Two systems, each owned by a team, each team with a lead and engineers. None
 * of this exists in the model's training data, so the baseline answer is always
 * "I don't know" — which makes it obvious when a knowledge-injection technique
 * worked. Variants 1–6 all answer the same QUESTION via different mechanisms, so
 * they're directly comparable. Variant 7 (RAG + MCP) answers DOC_QUESTION, whose
 * answer lives only in the deeper runbooks referenced by the `doc` field.
 */
export interface Doc {
  id: string;
  title: string;
  text: string;
  /** Optional pointer to a deeper technical doc (filename under a docs/ dir). */
  doc?: string;
}

export const CORPUS: Doc[] = [
  {
    id: "system-a",
    title: "system-a",
    text: "system-a is Helix's real-time event-streaming service. It is owned by Team Aurora and listens on port 7654 over TCP.",
    doc: "system-a.md",
  },
  {
    id: "system-b",
    title: "system-b",
    text: "system-b is Helix's distributed cache service. It is owned by Team Borealis and listens on port 9310.",
    doc: "system-b.md",
  },
  {
    id: "team-aurora",
    title: "Team Aurora",
    text: "Team Aurora owns system-a. The team lead is Maya Chen. The engineers are Liam Park and Sofia Rossi.",
  },
  {
    id: "team-borealis",
    title: "Team Borealis",
    text: "Team Borealis owns system-b. The team lead is Noah Kim. The engineers are Ava Singh and Omar Haddad.",
  },
  {
    id: "rate-limit",
    title: "Helix public API rate limit",
    text: "The Helix public API is limited to 7 requests per second per API key. Bursts above this return HTTP 429.",
  },
];

/**
 * Shared question for variants 1–6. Two hops: system-a → owning team → its lead.
 * Answer: Maya Chen (lead of Team Aurora, which owns system-a); port 7654.
 */
export const QUESTION =
  "Who leads the team that owns system-a, and what port does system-a listen on?";

/**
 * Question for variant 7 (RAG + MCP). The answer (deploy command + replica count)
 * exists ONLY in the deeper runbook referenced by system-a's `doc` field — the
 * RAG summary alone can't answer it, so the agent must fetch the doc over MCP.
 */
export const DOC_QUESTION =
  "How is system-a deployed to production, and how many replicas does it run?";
