import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * BOOST Conference — annual after-school / expanded-learning convening,
 * Palm Springs Convention Center, April 27–30, 2027.
 * Contacts published on boostconference.org/contact (2026-11-03).
 * Hunter Email Verifier: tia@, chloe@, meredith@ valid (2 credits for 4 checks).
 * terri@boostcollaborative.org is published in a mailto but Hunter says it will bounce;
 * her visible events line is the shared inspire@ inbox, so Meredith is the third named contact.
 */
export const BOOST_CONFERENCE_SEED: SeedOrgWithContactsInput = {
  name: "BOOST Conference",
  websiteUrl: "https://www.boostconference.org",
  locationCity: "Palm Springs",
  locationRegion: "CA",
  locationCountry: "US",
  organizationTypeKey: "conference",
  salesInitiative: "conferences_associations",
  opportunityTypeKey: "annual_conference",
  forceManualQueue: true,
  runPipeline: false,
  manualEventName: "BOOST Conference 2027",
  manualQueueTitle: "BOOST Conference 2027 — Palm Springs (Apr 27–30) participatory anthem",
  manualQueueDescription:
    "BOOST Collaborative’s annual conference — the largest global convening for after-school, expanded learning, and out-of-school-time professionals. Palm Springs Convention Center, April 27–30, 2027 (200+ workshops, BOOST Nation town halls, film festival). Pitch a shared-creation anthem for the educator community.",
  eventDateEstimate: "2027-04-27",
  eventDateConfidence: "confirmed",
  contacts: [
    {
      fullName: "Chloe Dorworth",
      email: "chloe@boostcollaborative.org",
      roleTitle: "Program Manager — Presenters & Workshops",
      roleCategory: "events",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Program manager for presenters, speakers, workshops, and program development — primary doorway for a live participatory moment.",
    },
    {
      fullName: "Meredith White",
      email: "meredith@boostcollaborative.org",
      roleTitle: "Program Consultant",
      roleCategory: "events",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Program consultant on program development and special projects — helps shape conference experiences beyond the workshop grid.",
    },
    {
      fullName: "Tia Quinn",
      email: "tia@boostcollaborative.org",
      roleTitle: "Founder & CEO",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Founder and CEO of BOOST Collaborative and founder of the annual BOOST Conference — can green-light flagship programming.",
    },
  ],
};

export type SeedBoostConferenceResult = {
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
 * Idempotent upsert of BOOST Conference + three doorway contacts.
 * Skips when import_metadata.boostConferenceSeeded is already true.
 */
export async function seedBoostConference(options?: { force?: boolean }): Promise<SeedBoostConferenceResult> {
  const force = Boolean(options?.force);
  const seed = BOOST_CONFERENCE_SEED;
  const result: SeedBoostConferenceResult = {
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
      if (existing && meta.boostConferenceSeeded === true) {
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
        boostConferenceSeeded: true,
        boostConferenceSeededAt: new Date().toISOString(),
        parentOrganization: "BOOST Collaborative",
        headquarters: "San Diego, CA",
        venue: "Palm Springs Convention Center",
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
export async function getBoostConferenceSeedStatus(): Promise<{
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
  const seed = BOOST_CONFERENCE_SEED;
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
  const markedSeeded = meta.boostConferenceSeeded === true;
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
