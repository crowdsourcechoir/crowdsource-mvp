import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * Resend Forward — inaugural one-day builders conference (SFJAZZ, San Francisco).
 * Contacts: Hunter Email Finder (2026-10-30) — 5 credits used for named finds;
 * Christina + Chris host Building Forward / own DX event ops; Zeno opens the day.
 */
export const RESEND_FORWARD_SEED: SeedOrgWithContactsInput = {
  name: "Resend Forward",
  websiteUrl: "https://resend.com/forward",
  locationCity: "San Francisco",
  locationRegion: "CA",
  locationCountry: "US",
  organizationTypeKey: "conference",
  salesInitiative: "conferences_associations",
  opportunityTypeKey: "annual_conference",
  forceManualQueue: true,
  runPipeline: false,
  manualEventName: "Resend Forward 2026",
  manualQueueTitle: "Resend Forward — SFJAZZ San Francisco (Oct 21) participatory anthem",
  manualQueueDescription:
    "Resend’s one-day builders conference at SFJAZZ — craft-focused founders, engineers, and designers. Pitch a shared-creation anthem for the Forward community (and next year’s gathering).",
  eventDateEstimate: "2026-10-21",
  eventDateConfidence: "confirmed",
  contacts: [
    {
      fullName: "Christina Martinez",
      email: "christina@resend.com",
      roleTitle: "Developer Experience / Conference Organizer",
      roleCategory: "events",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Leads Resend Forward staffing and day-of operations (Building Forward podcast) — primary doorway for live programming and attendee experience.",
    },
    {
      fullName: "Chris Pennington",
      email: "chris@resend.com",
      roleTitle: "Developer Experience Engineer",
      roleCategory: "events",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "DX teammate co-hosting Building Forward — helps shape community and conference experience design.",
    },
    {
      fullName: "Zeno Rocha",
      email: "zeno@resend.com",
      roleTitle: "CEO / Co-Founder",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Opens Resend Forward on the main stage — can green-light a flagship participatory moment for the builders gathering.",
    },
  ],
};

export type SeedResendForwardResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: number;
  skippedAlreadySeeded: number;
  errors: Array<{ name: string; error: string }>;
  organizations: Array<{
    id: string;
    name: string;
    created: boolean;
    contactCount: number;
    queueItemId: string | null;
  }>;
};

/**
 * Idempotent upsert of Resend Forward + three doorway contacts.
 * Skips when import_metadata.resendForwardSeeded is already true.
 */
export async function seedResendForward(options?: { force?: boolean }): Promise<SeedResendForwardResult> {
  const force = Boolean(options?.force);
  const seed = RESEND_FORWARD_SEED;
  const result: SeedResendForwardResult = {
    attempted: 1,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  try {
    if (!force) {
      const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
      const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
      if (existing && meta.resendForwardSeeded === true) {
        result.skippedAlreadySeeded = 1;
        result.organizations.push({
          id: existing.id,
          name: existing.name,
          created: false,
          contactCount: 0,
          queueItemId: null,
        });
        return result;
      }
    }

    const seeded: SeedOrgWithContactsResult = await seedOrgWithContacts(seed);

    await updateOrganization(seeded.organization.id, {
      importMetadata: {
        ...(seeded.organization.importMetadata ?? {}),
        resendForwardSeeded: true,
        resendForwardSeededAt: new Date().toISOString(),
        eventInbox: "forward@resend.com",
      },
    });

    if (seeded.created) result.createdOrgs = 1;
    else result.updatedOrgs = 1;
    result.contactsCreated = seeded.contactsCreated;
    result.contactsUpdated = seeded.contactsUpdated;
    if (seeded.manualEnqueue?.queueItemId) result.enqueued = 1;

    result.organizations.push({
      id: seeded.organization.id,
      name: seeded.organization.name,
      created: seeded.created,
      contactCount: seeded.contacts.length,
      queueItemId: seeded.manualEnqueue?.queueItemId ?? null,
    });
  } catch (err) {
    result.errors.push({
      name: seed.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/** Read-only progress check — no emails. */
export async function getResendForwardSeedStatus(): Promise<{
  expected: number;
  present: boolean;
  markedSeeded: boolean;
  contactCount: number;
  done: boolean;
  organization: {
    name: string;
    present: boolean;
    markedSeeded: boolean;
    contactCount: number;
  };
}> {
  const seed = RESEND_FORWARD_SEED;
  const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
  if (!existing) {
    return {
      expected: 1,
      present: false,
      markedSeeded: false,
      contactCount: 0,
      done: false,
      organization: {
        name: seed.name,
        present: false,
        markedSeeded: false,
        contactCount: 0,
      },
    };
  }
  const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
  const contacts = await listContactsForOrganization(existing.id);
  const markedSeeded = meta.resendForwardSeeded === true;
  const contactCount = contacts.length;
  return {
    expected: 1,
    present: true,
    markedSeeded,
    contactCount,
    done: markedSeeded && contactCount >= 3,
    organization: {
      name: existing.name,
      present: true,
      markedSeeded,
      contactCount,
    },
  };
}
