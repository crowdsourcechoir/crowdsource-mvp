import { AMPLIFY_CONFERENCES_2027_SEEDS } from "@/lib/sales/seed/amplify-conferences-2027";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";

export type SeedAmplifyConferencesResult = {
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
 * Idempotent upsert of the seven 2027 Amplify conferences + three doorway contacts each.
 * Skips an org when import_metadata.amplify2027Seeded is already true (re-run safe).
 */
export async function seedAmplifyConferences2027(options?: {
  /** Force re-seed even when amplify2027Seeded marker is present. */
  force?: boolean;
}): Promise<SeedAmplifyConferencesResult> {
  const force = Boolean(options?.force);
  const result: SeedAmplifyConferencesResult = {
    attempted: AMPLIFY_CONFERENCES_2027_SEEDS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  for (const seed of AMPLIFY_CONFERENCES_2027_SEEDS) {
    try {
      if (!force) {
        const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta.amplify2027Seeded === true) {
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

      const seeded: SeedOrgWithContactsResult = await seedOrgWithContacts({
        ...seed,
        // Marker so cron re-runs are no-ops after the first successful write.
        // withSalesInitiative in seedOrgWithContacts merges salesInitiative; we also
        // stamp amplify2027Seeded via a follow-up update below if needed.
      });

      await updateOrganization(seeded.organization.id, {
        importMetadata: {
          ...(seeded.organization.importMetadata ?? {}),
          amplify2027Seeded: true,
          amplify2027SeededAt: new Date().toISOString(),
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
export async function getAmplifyConferences2027SeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  withThreeContacts: number;
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

  for (const seed of AMPLIFY_CONFERENCES_2027_SEEDS) {
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
      markedSeeded: meta.amplify2027Seeded === true,
      contactCount: contacts.length,
    });
  }

  const present = organizations.filter((o) => o.present).length;
  const markedSeeded = organizations.filter((o) => o.markedSeeded).length;
  const withThreeContacts = organizations.filter((o) => o.contactCount >= 3).length;
  return {
    expected: AMPLIFY_CONFERENCES_2027_SEEDS.length,
    present,
    markedSeeded,
    withThreeContacts,
    done: markedSeeded === AMPLIFY_CONFERENCES_2027_SEEDS.length && withThreeContacts === AMPLIFY_CONFERENCES_2027_SEEDS.length,
    organizations,
  };
}
