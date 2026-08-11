/**
 * Seed long-tail organizations beyond the original Conferences + Fan Culture CSVs.
 *
 * Usage (from repo root, with .env.local or env vars set):
 *   node scripts/sales/import-longtail-orgs.mjs
 *   node scripts/sales/import-longtail-orgs.mjs --dry-run
 *
 * Creates organizations with source=manual and import_metadata.Priority=A so the
 * nightly pipeline picks them up ahead of lower-priority backlog. Skips domains /
 * normalized names that already exist.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadEnvLocal, getSupabaseAdmin, normalizeOrgName, extractDomain } from "./_shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

loadEnvLocal();
const db = getSupabaseAdmin();

const orgs = JSON.parse(readFileSync(join(__dirname, "data/longtail-orgs.json"), "utf8"));

function extractDomainLocal(url) {
  try {
    return extractDomain(url);
  } catch {
    return null;
  }
}

let created = 0;
let skipped = 0;

for (const row of orgs) {
  const name = String(row.name || "").trim();
  if (!name) continue;
  const websiteUrl = row.websiteUrl || null;
  const domain = extractDomainLocal(websiteUrl);
  const normalized = normalizeOrgName(name);

  let existing = null;
  if (domain) {
    const { data } = await db.from("organizations").select("id,name").eq("domain", domain).limit(1);
    existing = data?.[0] ?? null;
  }
  if (!existing) {
    const { data } = await db.from("organizations").select("id,name").eq("normalized_name", normalized).limit(1);
    existing = data?.[0] ?? null;
  }
  if (existing) {
    console.log(`skip (exists): ${name}`);
    skipped += 1;
    continue;
  }

  const payload = {
    name,
    normalized_name: normalized,
    domain,
    website_url: websiteUrl,
    source: "manual",
    is_existing_client: false,
    import_metadata: {
      Priority: "A",
      Category: row.category || "Associations / Leadership",
      importedAt: new Date().toISOString(),
      sourceFile: "longtail-orgs.json",
      Organization: name,
      "Annual Gathering / Event": row.eventName || null,
      "Why It Fits Crowdsource Choir Anthem Experience": row.rationale || null,
      "Source / Start URL": websiteUrl,
      seedKind: "longtail_beyond_first_lists",
    },
  };

  if (dryRun) {
    console.log(`dry-run create: ${name} (${domain})`);
    created += 1;
    continue;
  }

  const { error } = await db.from("organizations").insert(payload);
  if (error) {
    console.error(`fail: ${name}: ${error.message}`);
    continue;
  }
  console.log(`created: ${name}`);
  created += 1;
}

console.log(`\nDone. created=${created} skipped=${skipped} dryRun=${dryRun}`);
