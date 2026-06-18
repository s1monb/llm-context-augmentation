import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * Tiny terminal presentation helpers shared by the demos.
 *
 * The demos are run live in a talk, so each one is broken into labelled STEPs
 * with a presenter-gated pause between beats. These helpers give every variant
 * the same look so the audience can compare them step for step.
 */
export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

let stepNo = 0;

/** Print a numbered step banner. Counter is per-process, so it resets each run. */
export function step(title: string) {
  stepNo++;
  const bar = "━".repeat(64);
  console.log(`\n${c.cyan}${bar}${c.reset}`);
  console.log(`${c.cyan}${c.bold} STEP ${stepNo} · ${title}${c.reset}`);
  console.log(`${c.cyan}${bar}${c.reset}\n`);
}

/** Dim sub-text under a step. */
export function note(text: string) {
  console.log(`${c.dim}${text}${c.reset}`);
}

/** Block until the presenter presses Enter. */
export async function pause(message: string) {
  const rl = createInterface({ input, output });
  await rl.question(`\n${c.yellow}⏸  ${message}${c.reset}`);
  rl.close();
}
