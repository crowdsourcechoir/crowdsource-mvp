import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsInput,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";

/**
 * BECU — Tukwila credit union. Affinity partnerships cover pro sports,
 * universities, and cultural/entertainment partners (Seahawks, Storm, KEXP, Timbers).
 * Contacts: Hunter Email Finder + Verifier (2026-11-03). Credits used 9 → 13.5
 * (3 finds + 3 verifications). Eric owns activation; Karin runs sponsorships;
 * Teran can green-light brand and affinity work.
 */
export const BECU_SEED: SeedOrgWithContactsInput = {
  name: "BECU",
  websiteUrl: "https://www.becu.org",
  locationCity: "Tukwila",
  locationRegion: "WA",
  locationCountry: "US",
  organizationTypeKey: "corporation",
  salesInitiative: "sports_fan_culture",
  opportunityTypeKey: "fan_engagement_initiative",
  forceManualQueue: true,
  runPipeline: false,
  manualEventName: "BECU sports and entertainment partnerships",
  manualQueueTitle: "BECU — sponsorship for a sports & entertainment participatory anthem",
  manualQueueDescription:
    "BECU affinity partnerships span Seattle sports (Seahawks, Storm), Portland Timbers, university athletics, and cultural partners such as KEXP. Pitch a shared-creation anthem inside a sponsored sports or entertainment moment.",
  eventDateEstimate: null,
  eventDateConfidence: "unknown",
  contacts: [
    {
      fullName: "Eric Karp",
      email: "eric.karp@becu.org",
      roleTitle: "Director, Affinity Partnerships",
      roleCategory: "marketing",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Directs BECU affinity partnerships across sports, universities, community, and cultural organizations — primary doorway for a sponsored live moment.",
    },
    {
      fullName: "Karin Crane",
      email: "karin.crane@becu.org",
      roleTitle: "Affinity Sponsorship Manager",
      roleCategory: "marketing",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Manages sponsorship execution, including the Seattle Seahawks partnership and other affinity activations.",
    },
    {
      fullName: "Teran Evans",
      email: "teran.evans@becu.org",
      roleTitle: "VP, Brand Strategy & Affinity Partnerships",
      roleCategory: "executive",
      emailVerificationStatus: "verified_deliverable",
      roleDescription:
        "Leads brand strategy and affinity partnerships — can green-light a participatory anthem across sports and entertainment partners.",
    },
  ],
};

export type SeedBecuResult = {
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

/** Idempotent upsert of BECU + three sponsorship contacts. Skips when import_metadata.becuSeeded is set. */
export async function seedBecu(options?: { force?: boolean }): Promise<SeedBecuResult> {
  const force = Boolean(options?.force);
  const seed = BECU_SEED;
  const result: SeedBecuResult = {
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
      if (existing && meta.becuSeeded === true) {
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
        becuSeeded: true,
        becuSeededAt: new Date().toISOString(),
        partnershipFocus: "sponsorship, sports, entertainment",
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
export async function getBecuSeedStatus(): Promise<{
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
  const seed = BECU_SEED;
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
  const markedSeeded = meta.becuSeeded === true;
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
