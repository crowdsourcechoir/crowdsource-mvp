import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "../db/contacts";
import { requireSupabaseAdmin } from "../db/client";
import { normalizeEmail } from "../dedupe";

/**
 * Production bounce repairs for three approved digest leads (Jul 2026):
 * - AORN: Hunter-guessed @aorn.org board/award emails bounced
 * - NACADA (user said "macada"): invented elisa.shaffer@nacada.ksu.edu — real is elshaffer@ksu.edu
 * - U.S. Conference of Mayors: invented jocelynbogen@usmayors.org — real pattern is jbogen@; better buyer is Geri Powell
 *
 * Sources (public, verified at repair time):
 * - AORN Expo sales: aornexhibsales@wearemci.com (MCI prospectus); partner@aorn.org (AORN prospectus)
 * - NACADA: elshaffer@ksu.edu + nacada@ksu.edu (nacada.ksu.edu Cloudflare-decoded pages)
 * - USCM Business Council: gpowell@usmayors.org + jreid@usmayors.org (2025–26 Mayors Business Council brochure PDF)
 */

export type BouncedEmailRepairResult = {
  organizationId: string;
  organizationName: string;
  invalidated: { contactId: string; email: string }[];
  upserted: { contactId: string; email: string; fullName: string; created: boolean }[];
  draftsRetargeted: number;
};

const REPAIRS: {
  organizationId: string;
  organizationName: string;
  invalidateEmails: string[];
  contacts: {
    fullName: string;
    roleTitle: string;
    email: string;
    /** Prefer verified_deliverable for human-confirmed public addresses so they clear the queue gate. */
    emailVerificationStatus: "verified_deliverable" | "valid_format";
    sourceUrl: string;
  }[];
}[] = [
  {
    organizationId: "1e27b156-a0a1-45b1-b81d-54f3bee1b65b",
    organizationName: "Association of periOperative Registered Nurses",
    invalidateEmails: [
      "jdon-baker@aorn.org",
      "pgraling@aorn.org",
      "cmunro@aorn.org",
      "jspear@aorn.org",
      "cspry@aorn.org",
      "dwagner@aorn.org",
    ],
    contacts: [
      {
        fullName: "Cate David",
        roleTitle: "Account Executive, AORN Expo Sales (MCI)",
        email: "cate.david@wearemci.com",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://wearemci.us/files/AORN_2025_Prospectus.pdf",
      },
      {
        fullName: "AORN Expo Sales",
        roleTitle: "Expo / Exhibitor Sales Desk (MCI)",
        email: "aornexhibsales@wearemci.com",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://go.networkmediapartners.com/aorn-prospectus",
      },
      {
        fullName: "AORN Partnerships",
        roleTitle: "Vendor Partnerships",
        email: "partner@aorn.org",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://wearemci.us/files/AORN_2025_Prospectus.pdf",
      },
    ],
  },
  {
    organizationId: "99776134-9ed3-40cd-84f4-9c341fb9cac8",
    organizationName: "NACADA",
    invalidateEmails: ["elisa.shaffer@nacada.ksu.edu"],
    contacts: [
      {
        fullName: "Elisa Shaffer",
        roleTitle: "Senior Instructional Designer, Executive Office",
        email: "elshaffer@ksu.edu",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://nacada.ksu.edu/Programs-Services/eTutorials",
      },
      {
        fullName: "NACADA Executive Office",
        roleTitle: "Executive Office",
        email: "nacada@ksu.edu",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://nacada.ksu.edu/About-Us/Frequently-Asked-Questions.aspx",
      },
    ],
  },
  {
    organizationId: "09fbc5d4-0608-440a-ac42-f5624786e69c",
    organizationName: "U.S. Conference of Mayors",
    invalidateEmails: ["jocelynbogen@usmayors.org"],
    contacts: [
      {
        fullName: "Geri Powell",
        roleTitle: "Managing Director, Mayors Business Council",
        email: "gpowell@usmayors.org",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf",
      },
      {
        fullName: "Judy Reid",
        roleTitle: "Membership Services Manager, Mayors Business Council",
        email: "jreid@usmayors.org",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://www.usmayors.org/wp-content/uploads/2025/09/2025-2026-brochure-sep-3.pdf",
      },
      {
        fullName: "Jocelyn Bogen",
        roleTitle: "Program Director",
        email: "jbogen@usmayors.org",
        emailVerificationStatus: "verified_deliverable",
        sourceUrl: "https://www.usmayors.org/wp-content/uploads/2020/02/2019PlayBallReport.MEC_.pdf",
      },
    ],
  },
];

async function invalidateEmail(organizationId: string, email: string): Promise<{ contactId: string; email: string } | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const existing = await findExistingContact(organizationId, normalized, null);
  if (!existing) return null;
  if (existing.emailVerificationStatus === "invalid" && normalizeEmail(existing.email) === normalized) {
    return { contactId: existing.id, email: normalized };
  }
  await updateContact(existing.id, {
    emailVerificationStatus: "invalid",
    importMetadata: {
      ...(existing.importMetadata ?? {}),
      bouncedRepair: {
        markedInvalidAt: new Date().toISOString(),
        reason: "Outbound bounce — replaced with public verified address",
        previousEmail: existing.email,
      },
    },
  });
  return { contactId: existing.id, email: normalized };
}

async function upsertVerifiedContact(
  organizationId: string,
  spec: (typeof REPAIRS)[number]["contacts"][number]
): Promise<{ contactId: string; email: string; fullName: string; created: boolean }> {
  const normalized = normalizeEmail(spec.email)!;
  const existing = await findExistingContact(organizationId, normalized, spec.fullName);
  const metadata = {
    verifiedRepair: {
      repairedAt: new Date().toISOString(),
      sourceUrl: spec.sourceUrl,
      note: "Human-confirmed public address after outbound bounce",
    },
  };
  if (existing) {
    const updated = await updateContact(existing.id, {
      fullName: spec.fullName,
      roleTitle: spec.roleTitle,
      email: spec.email,
      emailVerificationStatus: spec.emailVerificationStatus,
      importMetadata: { ...(existing.importMetadata ?? {}), ...metadata },
    });
    return { contactId: updated.id, email: normalized, fullName: spec.fullName, created: false };
  }
  const created = await createContact({
    organizationId,
    fullName: spec.fullName,
    roleTitle: spec.roleTitle,
    email: spec.email,
    source: "manual",
    emailVerificationStatus: spec.emailVerificationStatus,
    importMetadata: metadata,
  });
  return { contactId: created.id, email: normalized, fullName: spec.fullName, created: true };
}

/**
 * Point approved/pending drafts for this org's opportunities at the preferred verified contact
 * (first upserted contact in the repair list) so "Open in email client" / re-send uses the new address.
 */
async function retargetDrafts(organizationId: string, preferredContactId: string): Promise<number> {
  const db = requireSupabaseAdmin();
  const { data: opps, error: oppError } = await db
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId);
  if (oppError) throw new Error(oppError.message);
  const oppIds = (opps ?? []).map((o) => o.id as string);
  if (oppIds.length === 0) return 0;

  const { data: drafts, error: draftError } = await db
    .from("outreach_drafts")
    .select("id, contact_id")
    .in("opportunity_id", oppIds);
  if (draftError) throw new Error(draftError.message);

  let updated = 0;
  for (const draft of drafts ?? []) {
    if (draft.contact_id === preferredContactId) continue;
    const { error } = await db
      .from("outreach_drafts")
      .update({ contact_id: preferredContactId, updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (error) throw new Error(error.message);
    updated += 1;
  }
  return updated;
}

export async function repairBouncedContactEmails(options?: {
  organizationIds?: string[];
}): Promise<BouncedEmailRepairResult[]> {
  const wanted = options?.organizationIds ? new Set(options.organizationIds) : null;
  const results: BouncedEmailRepairResult[] = [];

  for (const repair of REPAIRS) {
    if (wanted && !wanted.has(repair.organizationId)) continue;

    // Confirm the org still exists (ids are production UUIDs — skip quietly if a fresh DB).
    const existingContacts = await listContactsForOrganization(repair.organizationId).catch(() => null);
    if (existingContacts === null) continue;

    const invalidated: BouncedEmailRepairResult["invalidated"] = [];
    for (const email of repair.invalidateEmails) {
      const row = await invalidateEmail(repair.organizationId, email);
      if (row) invalidated.push(row);
    }

    const upserted: BouncedEmailRepairResult["upserted"] = [];
    for (const contact of repair.contacts) {
      upserted.push(await upsertVerifiedContact(repair.organizationId, contact));
    }

    const preferredContactId = upserted[0]?.contactId;
    const draftsRetargeted = preferredContactId
      ? await retargetDrafts(repair.organizationId, preferredContactId)
      : 0;

    results.push({
      organizationId: repair.organizationId,
      organizationName: repair.organizationName,
      invalidated,
      upserted,
      draftsRetargeted,
    });
  }

  return results;
}

export function listBouncedEmailRepairs() {
  return REPAIRS.map((r) => ({
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    invalidateEmails: r.invalidateEmails,
    replacementEmails: r.contacts.map((c) => ({
      fullName: c.fullName,
      roleTitle: c.roleTitle,
      email: c.email,
      sourceUrl: c.sourceUrl,
    })),
  }));
}
