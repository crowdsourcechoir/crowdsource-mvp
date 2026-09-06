#!/usr/bin/env node
/**
 * OCTO system coherence pass — the automated half of docs/agent-briefs/octo.md §4.
 *
 * Domain agents ship features. OCTO certifies the living system still holds.
 * This script covers build health. Seam checks and production pulse stay
 * manual (or browser-driven) and should be reported alongside this output.
 *
 * Usage: node scripts/octo-coherence-pass.mjs
 *        node scripts/octo-coherence-pass.mjs --skip-build   # lint + briefs only
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skipBuild = process.argv.includes("--skip-build");

function run(label, command, args) {
  console.log(`\n── ${label} ──`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    return false;
  }
  return result.status === 0;
}

const steps = [];
if (!skipBuild) {
  steps.push(["Build (type gate)", "npm", ["run", "build"]]);
}
steps.push(["Lint", "npm", ["run", "lint"]]);
steps.push(["Agent briefs", "node", ["scripts/check-agent-briefs.mjs"]]);

let failed = 0;
for (const [label, command, args] of steps) {
  if (!run(label, command, args)) failed += 1;
}

console.log("\n── Manual seam checks (OCTO reports these) ──");
console.log("See docs/agent-briefs/octo.md → System coherence pass → Domain seams.");
console.log("Touch only seams the change could have affected:");
console.log("  Garden ↔ Bloom · Bloom → /e/[slug] · Composer library scopes");
console.log("  Live → Composer gather · Roots methodology · Sales isolation");
console.log("Production pulse when live: Vercel deploy + relevant status endpoints.");

if (failed > 0) {
  console.error(`\nFAIL — ${failed} automated step(s) failed. Do not claim coherence yet.`);
  process.exit(1);
}

console.log("\nOK — automated coherence checks passed. Complete seam + production pulse, then report.");
