#!/usr/bin/env node
/**
 * Validates docs/agent-briefs/*.md.
 *
 * Two failure modes make a brief worse than useless: a missing section (the next
 * agent does not find what it expects) and a path that no longer exists (the next
 * agent trusts a stale map). This checks both.
 *
 * Usage: node scripts/check-agent-briefs.mjs
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const briefsDir = join(repoRoot, "docs", "agent-briefs");

const REQUIRED_SECTIONS = [
  "## 1. Mission",
  "## 2. Scope",
  "## 4. Code map",
  "## 5. State of play",
  "## 6. Rules and gotchas",
  "## 7. Open threads",
  "## 8. Handoff log",
];

/** Section 3 is "Start a new <NAME> agent", so match it by shape. */
const KICKOFF_HEADING = /^## 3\. Start a new .+ agent$/m;

/**
 * A backticked token is treated as a repo path when it looks like one: contains a
 * slash and either a known top-level directory or a file extension. Route
 * patterns (`/admin/sales`), CSS vars, and code identifiers are skipped.
 */
const TOP_LEVEL_DIRS = [
  "app",
  "components",
  "data",
  "docs",
  "lib",
  "Protocols",
  "public",
  "scripts",
  "supabase",
  "types",
  ".cursor",
];

function looksLikeRepoPath(token) {
  if (!token.includes("/")) return false;
  if (token.startsWith("/")) return false; // URL route, not a file
  if (token.startsWith("http")) return false;
  if (/\s/.test(token)) return false;
  return TOP_LEVEL_DIRS.some((dir) => token === dir || token.startsWith(`${dir}/`));
}

/**
 * Dynamic route segments are real on disk in Next.js ([id]), so paths resolve
 * directly. Glob-ish suffixes used for brevity in prose are trimmed first.
 */
function normalize(token) {
  return token.replace(/\/\*\*$/, "").replace(/\/\*$/, "").replace(/[.,;:)]+$/, "");
}

const failures = [];
const stats = { files: 0, paths: 0 };

const briefFiles = readdirSync(briefsDir)
  .filter((name) => name.endsWith(".md"))
  .sort();

if (briefFiles.length === 0) {
  console.error("No briefs found in docs/agent-briefs");
  process.exit(1);
}

for (const name of briefFiles) {
  const relative = join("docs", "agent-briefs", name);
  const body = readFileSync(join(briefsDir, name), "utf8");
  stats.files += 1;

  const isTemplate = name.startsWith("_");
  const isReadme = name === "README.md";

  if (!isReadme) {
    for (const heading of REQUIRED_SECTIONS) {
      if (!body.includes(heading)) {
        failures.push(`${relative}: missing section "${heading}"`);
      }
    }
    if (!KICKOFF_HEADING.test(body)) {
      failures.push(`${relative}: missing section "## 3. Start a new <NAME> agent"`);
    }
  }

  if (isTemplate) continue;

  const seen = new Set();
  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    const token = normalize(match[1].trim());
    if (!looksLikeRepoPath(token) || seen.has(token)) continue;
    seen.add(token);
    stats.paths += 1;
    if (!existsSync(join(repoRoot, token))) {
      failures.push(`${relative}: path does not exist — ${token}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} problem(s) across ${stats.files} file(s):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("");
  process.exit(1);
}

console.log(`OK — ${stats.files} files, ${stats.paths} repository paths verified.`);
