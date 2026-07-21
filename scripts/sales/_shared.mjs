// Shared helpers for the one-off sales-platform CSV import scripts.
// Plain .mjs (no build step) so these can be run directly with `node`, matching the existing
// scripts/ convention (see scripts/prod-preflight.mjs).
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

export function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local may not exist in some environments (e.g. CI) — rely on real env vars there.
  }
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Check .env.local.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields with embedded commas/newlines/escaped quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...dataRows] = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  return dataRows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function normalizeOrgName(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractDomain(urlOrDomain) {
  if (!urlOrDomain) return null;
  const trimmed = urlOrDomain.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

export async function findOrCreateOrganization(db, { name, websiteUrl, importMetadata, industrySegmentKeyHint }) {
  const domain = extractDomain(websiteUrl);
  const normalizedName = normalizeOrgName(name);

  if (domain) {
    const { data } = await db.from("organizations").select("*").eq("domain", domain).maybeSingle();
    if (data) return { organization: data, created: false };
  }
  const { data: byName } = await db.from("organizations").select("*").eq("normalized_name", normalizedName).maybeSingle();
  if (byName) return { organization: byName, created: false };

  const { data: created, error } = await db
    .from("organizations")
    .insert({
      name,
      normalized_name: normalizedName,
      domain,
      website_url: websiteUrl || null,
      source: "csv_import",
      import_metadata: { ...importMetadata, industrySegmentKeyHint },
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create organization "${name}": ${error.message}`);
  return { organization: created, created: true };
}

export async function getOrCreateIndustrySegmentId(db, key, label) {
  if (!key) return null;
  const { data } = await db.from("industry_segments").select("id").eq("key", key).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await db.from("industry_segments").insert({ key, label }).select("id").single();
  if (error) throw new Error(`Failed to create industry segment "${key}": ${error.message}`);
  return created.id;
}

/** One `csv_import` pipeline_run per organization, so imported findings/sources have somewhere to attach — see docs/sales-platform/database.md. */
export async function createImportPipelineRun(db, organizationId) {
  const { data, error } = await db
    .from("pipeline_runs")
    .insert({ organization_id: organizationId, trigger: "csv_import", status: "succeeded", started_at: new Date().toISOString(), finished_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(`Failed to create import pipeline_run: ${error.message}`);
  return data;
}

export async function createImportedFinding(db, { pipelineRunId, organizationId, opportunityId, url, claimType, claimText, claimValue }) {
  if (!url || !claimText) return null;
  const { data: source, error: sourceError } = await db
    .from("research_sources")
    .insert({ pipeline_run_id: pipelineRunId, url, fetched_at: new Date().toISOString(), retrieval_status: "imported" })
    .select()
    .single();
  if (sourceError) throw new Error(`Failed to create research_source: ${sourceError.message}`);

  const { error: findingError } = await db.from("research_findings").insert({
    pipeline_run_id: pipelineRunId,
    organization_id: organizationId,
    opportunity_id: opportunityId ?? null,
    source_id: source.id,
    claim_type: claimType,
    claim_text: claimText,
    claim_value: claimValue ?? null,
    origin: "human_provided",
  });
  if (findingError) throw new Error(`Failed to create research_finding: ${findingError.message}`);
  return source;
}

export async function getOpportunityTypeId(db, key) {
  const { data } = await db.from("opportunity_types").select("id").eq("key", key).maybeSingle();
  return data?.id ?? null;
}

export async function getOrganizationTypeId(db, key) {
  const { data } = await db.from("organization_types").select("id").eq("key", key).maybeSingle();
  return data?.id ?? null;
}

export async function findExistingContactByEmailOrName(db, organizationId, email, fullName) {
  const normalized = normalizeEmail(email);
  if (normalized) {
    const { data } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("normalized_email", normalized)
      .maybeSingle();
    if (data) return data;
  }
  if (fullName) {
    const { data } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("full_name", fullName)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}
