#!/usr/bin/env node
/**
 * Production readiness check — run before deploy:
 *   npm run preflight
 *
 * Loads .env.local if present (local only). On Vercel, env comes from project settings.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(join(root, ".env.local"));

const useLocal = process.env.USE_LOCAL_EVENTS === "true";
const requiredForProd = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ROOT_PAGE_PASSWORD",
];

const recommended = [
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

const errors = [];
const warnings = [];

if (useLocal) {
  warnings.push(
    "USE_LOCAL_EVENTS=true — events stay in memory. Set USE_LOCAL_EVENTS=false (or remove it) in production."
  );
}

for (const key of requiredForProd) {
  if (!process.env[key]?.trim()) {
    errors.push(`Missing required env: ${key}`);
  }
}

for (const key of recommended) {
  if (!process.env[key]?.trim()) {
    warnings.push(`Missing recommended env: ${key} (email captcha will not work)`);
  }
}

console.log("=== Crowdsource MVP — production preflight ===\n");

if (errors.length) {
  console.log("❌ Environment errors:");
  errors.forEach((e) => console.log(`   • ${e}`));
} else {
  console.log("✓ Required environment variables present");
}

if (warnings.length) {
  console.log("\n⚠ Warnings:");
  warnings.forEach((w) => console.log(`   • ${w}`));
}

async function testSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  console.log("\n--- Supabase connectivity ---");
  try {
    const res = await fetch(`${url}/rest/v1/events?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      errors.push(`Supabase query failed (${res.status}): ${body.slice(0, 200)}`);
      console.log(`❌ events table query failed: HTTP ${res.status}`);
      return;
    }
    console.log("✓ Supabase reachable — public.events query OK");

    const sg = await fetch(`${url}/rest/v1/songgarden_clips?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (sg.status === 404 || sg.status === 406) {
      warnings.push(
        "songgarden_clips table missing — run supabase/songgarden-tables.sql before Song Garden goes live"
      );
      console.log("⚠ songgarden_clips table not found — run supabase/songgarden-tables.sql");
    } else if (!sg.ok) {
      warnings.push(`songgarden_clips check returned HTTP ${sg.status}`);
      console.log(`⚠ songgarden_clips check: HTTP ${sg.status}`);
    } else {
      console.log("✓ songgarden_clips table OK");
    }
  } catch (e) {
    errors.push(`Supabase unreachable: ${e instanceof Error ? e.message : String(e)}`);
    console.log(`❌ Supabase unreachable: ${e instanceof Error ? e.message : e}`);
  }
}

console.log("\n--- Production build ---");
const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit", shell: true });
if (build.status !== 0) {
  errors.push("npm run build failed");
  console.log("❌ Build failed");
} else {
  console.log("✓ Build passed");
}

await testSupabase();

console.log("\n--- Supabase SQL (run in SQL Editor if not done) ---");
const sqlFiles = [
  "supabase/events-table.sql",
  "supabase/prod-patch-events-columns.sql",
  "supabase/agent-interview-tables.sql",
  "supabase/agent-turn-transcripts.sql",
  "supabase/songgarden-tables.sql",
  "supabase/songgarden-spam-columns.sql (if songgarden exists)",
];
sqlFiles.forEach((f) => console.log(`   • ${f}`));

console.log("\n--- Vercel env (Production) ---");
console.log("   USE_LOCAL_EVENTS=false  (or omit entirely)");
console.log("   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
console.log("   OPENAI_API_KEY, ROOT_PAGE_PASSWORD");
console.log("   NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY");
console.log("   Add app.crowdsourcechoir.com to Turnstile allowed hostnames.");

console.log("\n--- Post-deploy smoke test (https://app.crowdsourcechoir.com) ---");
console.log("   1. /admin/events — list loads from Supabase");
console.log("   2. /e/<slug> — participant journey (lyric + garden)");
console.log("   3. /api/turnstile/status — turnstile configured");

if (errors.length) {
  console.log(`\n❌ Preflight failed (${errors.length} error(s))`);
  process.exit(1);
}

console.log("\n✓ Preflight passed — ready to deploy");
process.exit(0);
