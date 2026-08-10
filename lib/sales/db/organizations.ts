import { requireSupabaseAdmin } from "./client";
import { normalizeOrgName, extractDomain } from "../dedupe";
import type { Organization } from "../types";

function rowToOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    normalizedName: row.normalized_name as string,
    domain: (row.domain as string | null) ?? null,
    organizationTypeId: (row.organization_type_id as string | null) ?? null,
    industrySegmentId: (row.industry_segment_id as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    locationCity: (row.location_city as string | null) ?? null,
    locationRegion: (row.location_region as string | null) ?? null,
    locationCountry: (row.location_country as string | null) ?? null,
    estimatedSize: (row.estimated_size as string | null) ?? null,
    source: (row.source as Organization["source"]) ?? "manual",
    duplicateOfOrganizationId: (row.duplicate_of_organization_id as string | null) ?? null,
    isExistingClient: (row.is_existing_client as boolean) ?? false,
    importMetadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export type CreateOrganizationInput = {
  name: string;
  organizationTypeId?: string | null;
  industrySegmentId?: string | null;
  websiteUrl?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountry?: string | null;
  estimatedSize?: string | null;
  source?: Organization["source"];
  isExistingClient?: boolean;
  importMetadata?: Record<string, unknown> | null;
};

export async function listOrganizations(params?: { limit?: number; search?: string }): Promise<Organization[]> {
  const db = requireSupabaseAdmin();
  let query = db.from("organizations").select("*").order("created_at", { ascending: false });
  if (params?.search) query = query.ilike("name", `%${params.search}%`);
  if (params?.limit) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrganization);
}

/** Organizations that have never been through a real pipeline run (excludes the `csv_import` bookkeeping runs created at import time) and aren't marked as existing clients — the pool the "run next N" batch control draws from. Priority "A" rows (from the source CSVs) go first. */
export async function listUnprocessedOrganizations(limit: number): Promise<Organization[]> {
  const db = requireSupabaseAdmin();
  const { data: runs, error: runsError } = await db.from("pipeline_runs").select("organization_id").neq("trigger", "csv_import");
  if (runsError) throw new Error(runsError.message);
  const processedIds = new Set((runs ?? []).map((r) => r.organization_id as string));

  const { data: orgs, error: orgsError } = await db
    .from("organizations")
    .select("*")
    .eq("is_existing_client", false)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (orgsError) throw new Error(orgsError.message);

  const candidates = (orgs ?? []).map(rowToOrganization).filter((o) => !processedIds.has(o.id));
  candidates.sort((a, b) => {
    const priority = (o: Organization) => String((o.importMetadata as { Priority?: string } | null)?.Priority ?? "Z");
    return priority(a).localeCompare(priority(b));
  });
  return candidates.slice(0, limit);
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("organizations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToOrganization(data) : null;
}

/**
 * Domains already in the org table — used by discovery to append `-site:` excludes so SERPs
 * dig past the seeded CSV head. Newest-first so the rotating exclude window still cycles.
 */
export async function listKnownOrganizationDomains(limit: number): Promise<string[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("organizations")
    .select("domain")
    .not("domain", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, limit * 3));
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const row of data ?? []) {
    const domain = String(row.domain ?? "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
    if (domains.length >= limit) break;
  }
  return domains;
}

/** Finds an existing org by domain first (strongest signal), then normalized name.
 * Uses limit(1) rather than maybeSingle: duplicate domain/normalized_name rows exist in
 * production (no unique constraint), and maybeSingle throws
 * "JSON object requested, multiple (or no) rows returned" — which was aborting every
 * discovery cron run and starving the morning digest of new 70+ leads.
 */
export async function findExistingOrganization(name: string, websiteUrl?: string | null): Promise<Organization | null> {
  const db = requireSupabaseAdmin();
  const domain = extractDomain(websiteUrl);
  if (domain) {
    const { data, error } = await db
      .from("organizations")
      .select("*")
      .eq("domain", domain)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]) return rowToOrganization(data[0]);
  }
  const normalized = normalizeOrgName(name);
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("normalized_name", normalized)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ? rowToOrganization(data[0]) : null;
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const db = requireSupabaseAdmin();
  const row = {
    name: input.name,
    normalized_name: normalizeOrgName(input.name),
    domain: extractDomain(input.websiteUrl),
    organization_type_id: input.organizationTypeId ?? null,
    industry_segment_id: input.industrySegmentId ?? null,
    website_url: input.websiteUrl ?? null,
    location_city: input.locationCity ?? null,
    location_region: input.locationRegion ?? null,
    location_country: input.locationCountry ?? null,
    estimated_size: input.estimatedSize ?? null,
    source: input.source ?? "manual",
    is_existing_client: input.isExistingClient ?? false,
    import_metadata: input.importMetadata ?? null,
  };
  const { data, error } = await db.from("organizations").insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToOrganization(data);
}

export async function updateOrganization(id: string, patch: Partial<CreateOrganizationInput>): Promise<Organization> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    row.name = patch.name;
    row.normalized_name = normalizeOrgName(patch.name);
  }
  if (patch.organizationTypeId !== undefined) row.organization_type_id = patch.organizationTypeId;
  if (patch.industrySegmentId !== undefined) row.industry_segment_id = patch.industrySegmentId;
  if (patch.websiteUrl !== undefined) {
    row.website_url = patch.websiteUrl;
    row.domain = extractDomain(patch.websiteUrl);
  }
  if (patch.locationCity !== undefined) row.location_city = patch.locationCity;
  if (patch.locationRegion !== undefined) row.location_region = patch.locationRegion;
  if (patch.locationCountry !== undefined) row.location_country = patch.locationCountry;
  if (patch.estimatedSize !== undefined) row.estimated_size = patch.estimatedSize;
  if (patch.isExistingClient !== undefined) row.is_existing_client = patch.isExistingClient;
  const { data, error } = await db.from("organizations").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToOrganization(data);
}
