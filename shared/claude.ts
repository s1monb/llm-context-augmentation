import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

/** The model every demo talks to. */
export const MODEL = "claude-opus-4-8";

/** Shared client — reads ANTHROPIC_API_KEY from the environment (.env). */
export const client = new Anthropic();

/**
 * One-shot question helper. Used by the non-agentic demos that build a context
 * string themselves and just want a single answer back.
 */
export async function ask(params: {
  prompt: string;
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
