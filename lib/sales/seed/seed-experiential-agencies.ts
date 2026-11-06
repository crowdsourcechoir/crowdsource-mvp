import {
  EXPERIENTIAL_AGENCIES_ALREADY_SEEDED,
  EXPERIENTIAL_AGENCIES_SEEDS,
} from "@/lib/sales/seed/experiential-agencies";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";

export type SeedExperientialAgenciesResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  contactsCreated: number;
  contactsUpdated: number;
  enqueued: number;
  skippedAlreadySeeded: number;
  duplicatesNoted: Array<{ name: string; reason: string }>;
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
 * Idempotent upsert of experiential / brand-experience agencies into Booking agents.
 * Skips when import_metadata.experientialAgenciesSeeded is true.
 */
export async function seedExperientialAgencies(options?: {
  force?: boolean;
}): Promise<SeedExperientialAgenciesResult> {
  const force = Boolean(options?.force);
  const result: SeedExperientialAgenciesResult = {
    attempted: EXPERIENTIAL_AGENCIES_SEEDS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    duplicatesNoted: EXPERIENTIAL_AGENCIES_ALREADY_SEEDED.map((d) => ({
      name: d.name,
      reason: d.reason,
    })),
    errors: [],
    organizations: [],
  };

  for (const seed of EXPERIENTIAL_AGENCIES_SEEDS) {
    try {
      if (!force) {
        const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta.experientialAgenciesSeeded === true) {
          result.skippedAlreadySeeded += 1;
          result.organizations.push({
            id: existing.id,
            name: existing.name,
            created: false,
            contactCount: 0,
            queueItemId: null,
          });
          continue;
        }
      }

      const seeded: SeedOrgWithContactsResult = await seedOrgWithContacts(seed);

      await updateOrganization(seeded.organization.id, {
        importMetadata: {
          ...(seeded.organization.importMetadata ?? {}),
          experientialAgenciesSeeded: true,
          experientialAgenciesSeededAt: new Date().toISOString(),
          bookingAgentKind: "experiential_agency",
          salesInitiative: "booking_agents",
          revenueEngine: "premium",
        },
      });

      if (seeded.created) result.createdOrgs += 1;
      else result.updatedOrgs += 1;
      result.contactsCreated += seeded.contactsCreated;
      result.contactsUpdated += seeded.contactsUpdated;
      if (seeded.manualEnqueue?.queueItemId) result.enqueued += 1;

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
  }

  return result;
}

export async function getExperientialAgenciesSeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  done: boolean;
  alreadySeededDuplicates: typeof EXPERIENTIAL_AGENCIES_ALREADY_SEEDED;
  organizations: Array<{
    name: string;
    present: boolean;
    markedSeeded: boolean;
    contactCount: number;
  }>;
}> {
  const organizations: Array<{
    name: string;
    present: boolean;
    markedSeeded: boolean;
    contactCount: number;
  }> = [];

  for (const seed of EXPERIENTIAL_AGENCIES_SEEDS) {
    const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
    const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
    const markedSeeded = Boolean(existing && meta.experientialAgenciesSeeded === true);
    let contactCount = 0;
    if (existing) {
      const contacts = await listContactsForOrganization(existing.id);
      contactCount = contacts.filter((c) => !c.duplicateOfContactId).length;
    }
    organizations.push({
      name: seed.name,
      present: Boolean(existing),
      markedSeeded,
      contactCount,
    });
  }

  const present = organizations.filter((o) => o.present).length;
  const markedSeeded = organizations.filter((o) => o.markedSeeded).length;
  return {
    expected: EXPERIENTIAL_AGENCIES_SEEDS.length,
    present,
    markedSeeded,
    done: markedSeeded === EXPERIENTIAL_AGENCIES_SEEDS.length,
    alreadySeededDuplicates: EXPERIENTIAL_AGENCIES_ALREADY_SEEDED,
    organizations,
  };
}
