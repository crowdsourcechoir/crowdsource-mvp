import { requireSupabaseAdmin } from "./client";
import { normalizeEmail } from "../dedupe";
import { classifyOutreachPersona } from "../outreach/persona";
import type { Contact } from "../types";

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    fullName: (row.full_name as string | null) ?? null,
    roleTitle: (row.role_title as string | null) ?? null,
    roleCategory: (row.role_category as string | null) ?? null,
    // Legacy rows created before this column existed classify on read rather than needing a
    // backfill migration to be "correct" — the stored value (once backfilled) is just a cache.
    outreachPersona: (row.outreach_persona as Contact["outreachPersona"] | null) ?? classifyOutreachPersona(row.role_title as string | null),
    email: (row.email as string | null) ?? null,
    normalizedEmail: (row.normalized_email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    emailVerificationStatus: (row.email_verification_status as Contact["emailVerificationStatus"]) ?? "unverified",
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    source: (row.source as Contact["source"]) ?? "manual",
    duplicateOfContactId: (row.duplicate_of_contact_id as string | null) ?? null,
    importMetadata: (row.import_metadata as Record<string, unknown> | null) ?? null,
    enrichmentAttemptedAt: (row.enrichment_attempted_at as string | null) ?? null,
    enrichmentProvider: (row.enrichment_provider as Contact["enrichmentProvider"]) ?? null,
    enrichmentStatus: (row.enrichment_status as Contact["enrichmentStatus"]) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export type CreateContactInput = {
  organizationId: string;
  fullName?: string | null;
  roleTitle?: string | null;
  roleCategory?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  source?: Contact["source"];
  emailVerificationStatus?: Contact["emailVerificationStatus"];
  importMetadata?: Record<string, unknown> | null;
};

export async function listContactsForOrganization(organizationId: string): Promise<Contact[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToContact);
}

export async function listContactsForOrganizations(organizationIds: string[]): Promise<Contact[]> {
  const unique = Array.from(new Set(organizationIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const db = requireSupabaseAdmin();
  const rows: Contact[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await db.from("contacts").select("*").in("organization_id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(rowToContact));
  }
  return rows;
}

export async function getContact(id: string): Promise<Contact | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToContact(data) : null;
}

export async function listContactsByIds(ids: string[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const db = requireSupabaseAdmin();
  const unique = Array.from(new Set(ids));
  const rows: Contact[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await db.from("contacts").select("*").in("id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(rowToContact));
  }
  return rows;
}

export async function listContactsByNormalizedEmail(email: string): Promise<Contact[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("contacts").select("*").eq("normalized_email", normalized);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToContact);
}

/** Dedupe within an org: by normalized email if present, else by exact full name match.
 * limit(1) instead of maybeSingle — duplicate contact rows must not crash discovery/pipeline. */
export async function findExistingContact(organizationId: string, email?: string | null, fullName?: string | null): Promise<Contact | null> {
  const db = requireSupabaseAdmin();
  const normalized = normalizeEmail(email);
  if (normalized) {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("normalized_email", normalized)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]) return rowToContact(data[0]);
  }
  if (fullName) {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("full_name", fullName)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]) return rowToContact(data[0]);
  }
  return null;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const row = {
    organization_id: input.organizationId,
    full_name: input.fullName ?? null,
    role_title: input.roleTitle ?? null,
    role_category: input.roleCategory ?? null,
    outreach_persona: classifyOutreachPersona(input.roleTitle),
    email: normalizeEmail(input.email) ? input.email : null, // guards against a model emitting the literal word "null" instead of an actual null
    normalized_email: normalizeEmail(input.email),
    phone: input.phone ?? null,
    linkedin_url: input.linkedinUrl ?? null,
    source: input.source ?? "manual",
    email_verification_status: input.emailVerificationStatus ?? "unverified",
    import_metadata: input.importMetadata ?? null,
  };
  const { data, error } = await db.from("contacts").insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}

export type UpdateContactInput = {
  fullName?: string | null;
  roleTitle?: string | null;
  roleCategory?: string | null;
  email?: string | null;
  emailVerificationStatus?: Contact["emailVerificationStatus"];
  importMetadata?: Record<string, unknown> | null;
  duplicateOfContactId?: string | null;
};

export async function updateContact(id: string, patch: UpdateContactInput): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.roleTitle !== undefined) {
    row.role_title = patch.roleTitle;
    row.outreach_persona = classifyOutreachPersona(patch.roleTitle);
  }
  if (patch.roleCategory !== undefined) row.role_category = patch.roleCategory;
  if (patch.email !== undefined) {
    const normalized = normalizeEmail(patch.email);
    row.email = normalized ? patch.email : null;
    row.normalized_email = normalized;
  }
  if (patch.emailVerificationStatus !== undefined) {
    row.email_verification_status = patch.emailVerificationStatus;
  }
  if (patch.importMetadata !== undefined) row.import_metadata = patch.importMetadata;
  if (patch.duplicateOfContactId !== undefined) row.duplicate_of_contact_id = patch.duplicateOfContactId;
  const { data, error } = await db.from("contacts").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}

export async function updateContactVerification(
  id: string,
  status: Contact["emailVerificationStatus"]
): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("contacts")
    .update({ email_verification_status: status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}

/**
 * Records the outcome of a paid enrichment API call and, if an email was found, sets it (and
 * resets email_verification_status to 'unverified' so the verify_contact stage re-checks it).
 *
 * `enrichment_attempted_at` is set on `found` / `not_found` only — provider errors (429, timeout,
 * free-plan 403) must be retryable on the next pipeline re-run or after monthly credit reset.
 */
export async function markContactEnriched(
  id: string,
  result: { provider: Contact["enrichmentProvider"]; status: Contact["enrichmentStatus"]; email: string | null }
): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const patch: Record<string, unknown> = {
    enrichment_provider: result.provider,
    enrichment_status: result.status,
    updated_at: new Date().toISOString(),
  };
  if (result.status === "found" || result.status === "not_found") {
    patch.enrichment_attempted_at = new Date().toISOString();
  }
  if (result.status === "found" && result.email) {
    patch.email = result.email;
    patch.normalized_email = normalizeEmail(result.email);
    patch.email_verification_status = "unverified";
  }
  const { data, error } = await db.from("contacts").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}

/**
 * Clears burned enrichment attempts that ended in provider error so Hunter/Apollo can be
 * retried (free-plan 403s and rate limits used to stamp enrichment_attempted_at forever).
 */
export async function clearFailedEnrichmentAttempts(organizationIds?: string[]): Promise<number> {
  const db = requireSupabaseAdmin();
  let query = db
    .from("contacts")
    .update({
      enrichment_attempted_at: null,
      enrichment_status: null,
      updated_at: new Date().toISOString(),
    })
    .eq("enrichment_status", "error")
    .is("email", null);
  if (organizationIds && organizationIds.length > 0) {
    query = query.in("organization_id", organizationIds);
  }
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
