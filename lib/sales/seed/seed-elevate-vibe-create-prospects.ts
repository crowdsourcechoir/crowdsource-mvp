import { ELEVATE_VIBE_CREATE_PROSPECTS } from "@/lib/sales/seed/elevate-vibe-create-prospects";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";

export type SeedElevateVibeCreateResult = {
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
 * Idempotent upsert of the Elevate / Vibe / Create / human-potential prospect list
 * (29 conferences) + up to three doorway contacts each.
 * Skips an org when import_metadata.elevateVibeCreateSeeded is already true.
 */
export async function seedElevateVibeCreateProspects(options?: {
  force?: boolean;
}): Promise<SeedElevateVibeCreateResult> {
  const force = Boolean(options?.force);
  const result: SeedElevateVibeCreateResult = {
    attempted: ELEVATE_VIBE_CREATE_PROSPECTS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  for (const seed of ELEVATE_VIBE_CREATE_PROSPECTS) {
    try {
      if (!force) {
        const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta.elevateVibeCreateSeeded === true) {
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
          elevateVibeCreateSeeded: true,
          elevateVibeCreateSeededAt: new Date().toISOString(),
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
export async function getElevateVibeCreateSeedStatus(): Promise<{
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

  for (const seed of ELEVATE_VIBE_CREATE_PROSPECTS) {
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
      markedSeeded: meta.elevateVibeCreateSeeded === true,
      contactCount: contacts.length,
    });
  }

  const present = organizations.filter((o) => o.present).length;
  const markedSeeded = organizations.filter((o) => o.markedSeeded).length;
  const withThreeContacts = organizations.filter((o) => o.contactCount >= 3).length;
  return {
    expected: ELEVATE_VIBE_CREATE_PROSPECTS.length,
    present,
    markedSeeded,
    withThreeContacts,
    done:
      markedSeeded === ELEVATE_VIBE_CREATE_PROSPECTS.length &&
      withThreeContacts === ELEVATE_VIBE_CREATE_PROSPECTS.length,
    organizations,
  };
}
