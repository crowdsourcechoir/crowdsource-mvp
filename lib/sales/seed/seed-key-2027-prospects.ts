import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { getOpportunity, updateOpportunityImportMetadata } from "@/lib/sales/db/opportunities";
import { findExistingOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { PRICING_FRAMEWORK_VERSION } from "@/lib/sales/pricing/metadata";
import { KEY_2027_PROSPECT_SEEDS } from "@/lib/sales/seed/key-2027-prospects";
import {
  seedOrgWithContacts,
  type SeedOrgWithContactsResult,
} from "@/lib/sales/seed/seed-org-with-contacts";

const SEEDED_FLAG = "key2027ProspectsSeeded";

export type SeedKey2027ProspectsResult = {
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

export async function seedKey2027Prospects(options?: {
  force?: boolean;
}): Promise<SeedKey2027ProspectsResult> {
  const force = Boolean(options?.force);
  const result: SeedKey2027ProspectsResult = {
    attempted: KEY_2027_PROSPECT_SEEDS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    enqueued: 0,
    skippedAlreadySeeded: 0,
    errors: [],
    organizations: [],
  };

  for (const seed of KEY_2027_PROSPECT_SEEDS) {
    try {
      if (!force) {
        const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
        const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
        if (existing && meta[SEEDED_FLAG] === true) {
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
      const nowIso = new Date().toISOString();

      await updateOrganization(seeded.organization.id, {
        importMetadata: {
          ...(seeded.organization.importMetadata ?? {}),
          [SEEDED_FLAG]: true,
          key2027ProspectsSeededAt: nowIso,
          ...(seed.dealType ? { dealType: seed.dealType } : {}),
        },
      });

      if (seeded.manualEnqueue?.opportunityId) {
        const opp = await getOpportunity(seeded.manualEnqueue.opportunityId);
        if (opp) {
          await updateOpportunityImportMetadata(opp.id, {
            ...(opp.importMetadata ?? {}),
            suggestedAnthemFee: seed.suggestedAnthemFee,
            pricingCategory: seed.pricingCategory,
            pricingTier: seed.pricingTier,
            pricingConfidence: "high",
            pricingRationale: `Researched 2027 flagship event (${seed.manualEventName ?? seed.name}) with published contacts.`,
            pricingEvaluatedAt: nowIso,
            pricingFrameworkVersion: PRICING_FRAMEWORK_VERSION,
            ...(seed.dealType ? { dealType: seed.dealType } : {}),
          });
        }
      }

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
        error: err instanceof Error ? err.message : "Seed failed",
      });
    }
  }

  return result;
}

export async function getKey2027ProspectsSeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  done: boolean;
  organizations: Array<{ name: string; present: boolean; markedSeeded: boolean; contactCount: number }>;
}> {
  const organizations = [];
  for (const seed of KEY_2027_PROSPECT_SEEDS) {
    const existing = await findExistingOrganization(seed.name, seed.websiteUrl);
    if (!existing) {
      organizations.push({ name: seed.name, present: false, markedSeeded: false, contactCount: 0 });
      continue;
    }
    const meta = (existing.importMetadata ?? {}) as Record<string, unknown>;
    const contacts = await listContactsForOrganization(existing.id);
    organizations.push({
      name: seed.name,
      present: true,
      markedSeeded: meta[SEEDED_FLAG] === true,
      contactCount: contacts.length,
    });
  }
  const present = organizations.filter((org) => org.present).length;
  const markedSeeded = organizations.filter((org) => org.markedSeeded).length;
  return {
    expected: KEY_2027_PROSPECT_SEEDS.length,
    present,
    markedSeeded,
    done: markedSeeded === KEY_2027_PROSPECT_SEEDS.length && present === KEY_2027_PROSPECT_SEEDS.length,
    organizations,
  };
}
