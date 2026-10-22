import { SEATTLE_FUNDRAISERS_2027_SEEDS } from "@/lib/sales/seed/seattle-fundraisers-2027";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";

export type SeedSeattleFundraisersResult = {
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
 * Idempotent upsert of Seattle-area auction/gala shortlist + up to 3 doorway contacts each.
 * Skips an org when import_metadata.seattleFundraisers2027Seeded is already true.
 */
export async function seedSeattleFundraisers2027(options?: {
  force?: boolean;
  /** Cap how many not-yet-seeded orgs to process this run (cron resumes later). */
  limit?: number;
}): Promise<SeedSeattleFundraisersResult> {
  const force = Boolean(options?.force);
  const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 20;
  const result: SeedSeattleFundraisersResult = {
    attempted: SEATTLE_FUNDRAISERS_2027_SEEDS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  let processed = 0;
  for (const seed of SEATTLE_FUNDRAISERS_2027_SEEDS) {
    try {
      if (!force) {
        const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta.seattleFundraisers2027Seeded === true) {
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

      if (processed >= limit) {
        break;
      }
      processed += 1;

      const seeded: SeedOrgWithContactsResult = await seedOrgWithContacts(seed);

      await updateOrganization(seeded.organization.id, {
        importMetadata: {
          ...(seeded.organization.importMetadata ?? {}),
          seattleFundraisers2027Seeded: true,
          seattleFundraisers2027SeededAt: new Date().toISOString(),
          operatorQueuedAt: new Date().toISOString(),
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

/** Read-only progress check — org names + contact counts, no emails. */
export async function getSeattleFundraisers2027SeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  withContacts: number;
  done: boolean;
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

  for (const seed of SEATTLE_FUNDRAISERS_2027_SEEDS) {
    const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
    if (!existing) {
      organizations.push({
        name: seed.name,
        present: false,
        markedSeeded: false,
        contactCount: 0,
      });
      continue;
    }
    const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
    const contacts = await listContactsForOrganization(existing.id);
    organizations.push({
      name: seed.name,
      present: true,
      markedSeeded: meta.seattleFundraisers2027Seeded === true,
      contactCount: contacts.length,
    });
  }

  const present = organizations.filter((o) => o.present).length;
  const markedSeeded = organizations.filter((o) => o.markedSeeded).length;
  const withContacts = organizations.filter((o) => o.contactCount >= 1).length;
  return {
    expected: SEATTLE_FUNDRAISERS_2027_SEEDS.length,
    present,
    markedSeeded,
    withContacts,
    done: markedSeeded === SEATTLE_FUNDRAISERS_2027_SEEDS.length,
    organizations,
  };
}
