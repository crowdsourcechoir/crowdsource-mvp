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

export async function getContact(id: string): Promise<Contact | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToContact(data) : null;
}

/** Dedupe within an org: by normalized email if present, else by exact full name match. */
export async function findExistingContact(organizationId: string, email?: string | null, fullName?: string | null): Promise<Contact | null> {
  const db = requireSupabaseAdmin();
  const normalized = normalizeEmail(email);
  if (normalized) {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("normalized_email", normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToContact(data);
  }
  if (fullName) {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("full_name", fullName)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToContact(data);
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

export type UpdateContactInput = {
  fullName?: string | null;
  roleTitle?: string | null;
  roleCategory?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  emailVerificationStatus?: Contact["emailVerificationStatus"];
  importMetadata?: Record<string, unknown> | null;
};

/** Partial contact update used by repair scripts and the admin PATCH route. */
export async function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.roleTitle !== undefined) {
    patch.role_title = input.roleTitle;
    patch.outreach_persona = classifyOutreachPersona(input.roleTitle);
  }
  if (input.roleCategory !== undefined) patch.role_category = input.roleCategory;
  if (input.email !== undefined) {
    patch.email = normalizeEmail(input.email) ? input.email : null;
    patch.normalized_email = normalizeEmail(input.email);
  }
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.linkedinUrl !== undefined) patch.linkedin_url = input.linkedinUrl;
  if (input.emailVerificationStatus !== undefined) {
    patch.email_verification_status = input.emailVerificationStatus;
  }
  if (input.importMetadata !== undefined) patch.import_metadata = input.importMetadata;
  const { data, error } = await db.from("contacts").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}

/**
 * Records the outcome of a paid enrichment API call and, if an email was found, sets it (and
 * resets email_verification_status to 'unverified' so the verify_contact stage re-checks it).
 * `enrichment_attempted_at` is always set regardless of outcome — this is what prevents the
 * pipeline from re-spending a credit on the same contact on every future re-run.
 */
export async function markContactEnriched(
  id: string,
  result: { provider: Contact["enrichmentProvider"]; status: Contact["enrichmentStatus"]; email: string | null }
): Promise<Contact> {
  const db = requireSupabaseAdmin();
  const patch: Record<string, unknown> = {
    enrichment_attempted_at: new Date().toISOString(),
    enrichment_provider: result.provider,
    enrichment_status: result.status,
    updated_at: new Date().toISOString(),
  };
  if (result.status === "found" && result.email) {
    patch.email = result.email;
    patch.normalized_email = normalizeEmail(result.email);
    patch.email_verification_status = "unverified";
  }
  const { data, error } = await db.from("contacts").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToContact(data);
}
