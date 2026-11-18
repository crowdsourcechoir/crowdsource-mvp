import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { ELX_ANNUAL_CONGRESS_SEED } from "@/lib/sales/seed/elx-annual-congress";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";

const SEEDED_FLAG = "elxCongressSeeded";

export type SeedElxAnnualCongressResult = {
  name: string;
  created: boolean;
  alreadySeeded: boolean;
  contactsCreated: number;
  contactsUpdated: number;
  queueItemId: string | null;
  organizationId: string | null;
  error: string | null;
};

export async function seedElxAnnualCongress(options?: {
  force?: boolean;
}): Promise<SeedElxAnnualCongressResult> {
  const force = Boolean(options?.force);
  const seed = ELX_ANNUAL_CONGRESS_SEED;
  const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
  const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
  if (existing && meta[SEEDED_FLAG] === true && !force) {
    return {
      name: existing.name,
      created: meta.elxCongressCreated === true,
      alreadySeeded: true,
      contactsCreated: 0,
      contactsUpdated: 0,
      queueItemId: null,
      organizationId: existing.id,
      error: null,
    };
  }

  try {
    const seeded: SeedOrgWithContactsResult = await seedOrgWithContacts(seed);
    await updateOrganization(seeded.organization.id, {
      importMetadata: {
        ...(seeded.organization.importMetadata ?? {}),
        [SEEDED_FLAG]: true,
        elxCongressCreated: seeded.created,
        elxCongressSeededAt: new Date().toISOString(),
      },
    });
    return {
      name: seeded.organization.name,
      created: seeded.created,
      alreadySeeded: false,
      contactsCreated: seeded.contactsCreated,
      contactsUpdated: seeded.contactsUpdated,
      queueItemId: seeded.manualEnqueue?.queueItemId ?? null,
      organizationId: seeded.organization.id,
      error: null,
    };
  } catch (err) {
    return {
      name: seed.name,
      created: false,
      alreadySeeded: false,
      contactsCreated: 0,
      contactsUpdated: 0,
      queueItemId: null,
      organizationId: existing?.id ?? null,
      error: err instanceof Error ? err.message : "Seed failed",
    };
  }
}

export async function getElxAnnualCongressStatus(): Promise<{
  name: string;
  present: boolean;
  markedSeeded: boolean;
  created: boolean | null;
  contactCount: number;
  done: boolean;
  contacts: Array<{
    fullName: string | null;
    roleTitle: string | null;
    source: string;
    emailVerificationStatus: string | null;
  }>;
}> {
  const seed = ELX_ANNUAL_CONGRESS_SEED;
  const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
  if (!existing) {
    return {
      name: seed.name,
      present: false,
      markedSeeded: false,
      created: null,
      contactCount: 0,
      done: false,
      contacts: [],
    };
  }
  const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
  const contacts = await listContactsForOrganization(existing.id);
  const markedSeeded = meta[SEEDED_FLAG] === true;
  return {
    name: existing.name,
    present: true,
    markedSeeded,
    created: typeof meta.elxCongressCreated === "boolean" ? meta.elxCongressCreated : null,
    contactCount: contacts.length,
    done: markedSeeded && contacts.length > 0,
    contacts: contacts.map((contact) => ({
      fullName: contact.fullName,
      roleTitle: contact.roleTitle,
      source: contact.source,
      emailVerificationStatus: contact.emailVerificationStatus,
    })),
  };
}
