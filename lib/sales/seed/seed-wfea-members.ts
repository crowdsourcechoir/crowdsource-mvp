import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  updateContact,
} from "@/lib/sales/db/contacts";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import { updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import {
  genericMailboxLabel,
  isGenericMailboxEmail,
  isPlausibleEmail,
  looksLikePersonName,
} from "@/lib/sales/dedupe";
import { followUpPresetIso } from "@/lib/sales/follow-up/calendar";
import { withSalesInitiative } from "@/lib/sales/initiatives";
import { enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import {
  WFEA_MEMBERS,
  wfeaOperatorNotes,
  wfeaOpportunityTypeKey,
  type WfeaMember,
} from "@/lib/sales/seed/wfea-members";
import type { Contact, Organization } from "@/lib/sales/types";

const SEED_MARKER = "wfeaMembersSeeded";

export type SeedWfeaMembersResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: number;
  followUpsTagged: number;
  orgOnly: number;
  skippedAlreadySeeded: number;
  errors: Array<{ name: string; error: string }>;
  organizations: Array<{
    id: string;
    name: string;
    created: boolean;
    salesTarget: boolean;
    contactCount: number;
    queueItemId: string | null;
    nextFollowUpAt: string | null;
  }>;
};

function buildImportMetadata(
  existing: Record<string, unknown> | null | undefined,
  member: WfeaMember
): Record<string, unknown> {
  const notes = wfeaOperatorNotes(member);
  const priorNotes =
    typeof existing?.operatorNotes === "string" ? existing.operatorNotes.trim() : "";
  const operatorNotes =
    priorNotes && !priorNotes.includes("WFEA member directory")
      ? `${notes}\n\n---\n${priorNotes}`.slice(0, 4000)
      : notes;

  return withSalesInitiative(
    {
      ...(existing ?? {}),
      operatorNotes,
      wfeaMember: true,
      wfeaNetwork: true,
      wfeaSalesTarget: member.salesTarget,
      wfeaDirectoryPage: member.directoryPage,
      searchTags: ["wfea", "other"],
      searchHaystack: "wfea other western festival event association member directory",
      [SEED_MARKER]: true,
      wfeaMembersSeededAt: new Date().toISOString(),
    },
    "wfea_network"
  );
}

async function upsertOrg(member: WfeaMember): Promise<{ organization: Organization; created: boolean }> {
  const typeKey = member.organizationTypeKey || "other";
  const orgType = await findOrganizationTypeByKey(typeKey);
  const existing = await findExistingOrganization(member.name, member.websiteUrl);
  const meta = buildImportMetadata(existing?.importMetadata ?? null, member);

  if (!existing) {
    const organization = await createOrganization({
      name: member.name.trim(),
      websiteUrl: member.websiteUrl,
      locationCity: member.locationCity,
      locationRegion: member.locationRegion,
      locationCountry: member.locationCountry ?? "US",
      organizationTypeId: orgType?.id ?? null,
      source: "csv_import",
      isExistingClient: false,
      importMetadata: meta,
    });
    return { organization, created: true };
  }

  const organization = await updateOrganization(existing.id, {
    name: member.name.trim(),
    websiteUrl: member.websiteUrl ?? existing.websiteUrl,
    locationCity: member.locationCity ?? existing.locationCity,
    locationRegion: member.locationRegion ?? existing.locationRegion,
    locationCountry: member.locationCountry ?? existing.locationCountry ?? "US",
    organizationTypeId: orgType?.id ?? existing.organizationTypeId,
    importMetadata: meta,
  });
  return { organization, created: false };
}

async function upsertContacts(
  organization: Organization,
  member: WfeaMember
): Promise<{ created: number; updated: number; contacts: Contact[] }> {
  let created = 0;
  let updated = 0;
  const emails = Array.from(
    new Set((member.emails ?? []).map((e) => e.trim().toLowerCase()).filter(isPlausibleEmail))
  );
  const fullName = (member.contactFullName ?? "").trim();
  const personOk = looksLikePersonName(fullName);
  const roleTitle = "WFEA directory contact";
  const phone = member.phone?.trim() || null;

  if (emails.length === 0 && personOk) {
    const existing = await findExistingContact(organization.id, null, fullName);
    if (existing) {
      await updateContact(existing.id, {
        fullName,
        roleTitle: existing.roleTitle || roleTitle,
        phone: phone ?? existing.phone,
        importMetadata: { ...(existing.importMetadata ?? {}), wfeaDirectory: true },
      });
      updated += 1;
    } else {
      await createContact({
        organizationId: organization.id,
        fullName,
        roleTitle,
        phone,
        source: "csv_import",
        emailVerificationStatus: "unverified",
        importMetadata: { wfeaDirectory: true },
      });
      created += 1;
    }
  }

  for (const email of emails) {
    const generic = isGenericMailboxEmail(email);
    const displayName = personOk
      ? fullName
      : generic
        ? genericMailboxLabel(email)
        : fullName || "Directory Contact";
    // Named people need first+last for sendable; generic inboxes are fine alone.
    const contactName =
      personOk || generic
        ? displayName
        : looksLikePersonName(displayName)
          ? displayName
          : `${displayName} Contact`.replace(/\s+/g, " ").trim();
    const existing = await findExistingContact(organization.id, email, personOk ? fullName : null);
    if (existing) {
      await updateContact(existing.id, {
        fullName: personOk ? fullName : existing.fullName || contactName,
        roleTitle: existing.roleTitle || (generic ? "General inbox" : roleTitle),
        email,
        phone: phone ?? existing.phone,
        emailVerificationStatus:
          existing.emailVerificationStatus === "invalid"
            ? "valid_format"
            : existing.emailVerificationStatus === "unverified"
              ? "valid_format"
              : existing.emailVerificationStatus,
        importMetadata: { ...(existing.importMetadata ?? {}), wfeaDirectory: true },
      });
      updated += 1;
    } else {
      await createContact({
        organizationId: organization.id,
        fullName: personOk ? fullName : contactName,
        roleTitle: generic ? "General inbox" : roleTitle,
        email,
        phone,
        source: "csv_import",
        emailVerificationStatus: "valid_format",
        importMetadata: { wfeaDirectory: true },
      });
      created += 1;
    }
  }

  return {
    created,
    updated,
    contacts: await listContactsForOrganization(organization.id),
  };
}

/**
 * Idempotent import of WFEA directory members.
 * - All rows → organizations tagged wfea_network / Other (+ operator notes).
 * - Contacts when email or named person present.
 * - salesTarget + sendable email → approval queue + next_follow_up_at (+7 days).
 */
export async function seedWfeaMembers(options?: { force?: boolean }): Promise<SeedWfeaMembersResult> {
  const force = Boolean(options?.force);
  const result: SeedWfeaMembersResult = {
    attempted: WFEA_MEMBERS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    followUpsTagged: 0,
    orgOnly: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  for (const member of WFEA_MEMBERS) {
    try {
      if (!member.name?.trim()) continue;

      if (!force) {
        const existing = await findExistingOrganization(member.name, member.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta[SEED_MARKER] === true) {
          result.skippedAlreadySeeded += 1;
          result.organizations.push({
            id: existing.id,
            name: existing.name,
            created: false,
            salesTarget: member.salesTarget,
            contactCount: 0,
            queueItemId: null,
            nextFollowUpAt: null,
          });
          continue;
        }
      }

      const { organization, created } = await upsertOrg(member);
      const contactResult = await upsertContacts(organization, member);

      if (created) result.createdOrgs += 1;
      else result.updatedOrgs += 1;
      result.contactsCreated += contactResult.created;
      result.contactsUpdated += contactResult.updated;

      let queueItemId: string | null = null;
      let nextFollowUpAt: string | null = null;

      const shouldEnqueue = member.salesTarget && member.followUp;
      if (shouldEnqueue) {
        try {
          const oppType = wfeaOpportunityTypeKey(member.organizationTypeKey);
          const manual = await enqueueOrgManually({
            organization,
            title: `${organization.name} — WFEA network / participatory gathering`,
            description:
              "WFEA member directory import. Festival / event network contact — explore a participatory anthem or shared-creation moment for their gathering.",
            eventOrInitiativeName: "WFEA network outreach",
            opportunityTypeKey: oppType,
            totalScoreHint: 70,
          });
          queueItemId = manual.queueItemId;
          result.enqueued += 1;

          nextFollowUpAt = followUpPresetIso("next_week");
          await updateOpportunityTouchTimestamps(manual.opportunityId, { nextFollowUpAt });
          result.followUpsTagged += 1;
        } catch (enqueueErr) {
          // Org + contacts still saved; no sendable contact → stay org-only.
          result.errors.push({
            name: member.name,
            error: `enqueue: ${enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)}`,
          });
          result.orgOnly += 1;
        }
      } else {
        result.orgOnly += 1;
      }

      result.organizations.push({
        id: organization.id,
        name: organization.name,
        created,
        salesTarget: member.salesTarget,
        contactCount: contactResult.contacts.length,
        queueItemId,
        nextFollowUpAt,
      });
    } catch (err) {
      result.errors.push({
        name: member.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/** Read-only progress — names + counts only. */
export async function getWfeaMembersSeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  salesTargets: number;
  done: boolean;
  organizations: Array<{
    name: string;
    present: boolean;
    markedSeeded: boolean;
    salesTarget: boolean;
  }>;
}> {
  const organizations: Array<{
    name: string;
    present: boolean;
    markedSeeded: boolean;
    salesTarget: boolean;
  }> = [];

  for (const member of WFEA_MEMBERS) {
    const existing = await findExistingOrganization(member.name, member.websiteUrl);
    if (!existing) {
      organizations.push({
        name: member.name,
        present: false,
        markedSeeded: false,
        salesTarget: member.salesTarget,
      });
      continue;
    }
    const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
    organizations.push({
      name: member.name,
      present: true,
      markedSeeded: meta[SEED_MARKER] === true,
      salesTarget: member.salesTarget,
    });
  }

  const present = organizations.filter((o) => o.present).length;
  const markedSeeded = organizations.filter((o) => o.markedSeeded).length;
  return {
    expected: WFEA_MEMBERS.length,
    present,
    markedSeeded,
    salesTargets: WFEA_MEMBERS.filter((m) => m.salesTarget).length,
    done: markedSeeded === WFEA_MEMBERS.length,
    organizations,
  };
}
