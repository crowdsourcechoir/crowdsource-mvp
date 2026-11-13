import { extractDomain } from "@/lib/sales/dedupe";
import { findOpportunityTypeByKey, findOrganizationTypeByKey } from "@/lib/sales/db/lookups";
import {
  createOpportunity,
  findExistingOpportunityByTitle,
  listOpportunitiesForOrganization,
} from "@/lib/sales/db/opportunities";
import {
  createOrganization,
  findExistingOrganization,
  updateOrganization,
} from "@/lib/sales/db/organizations";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import {
  SEATTLE_SPORTS_PARTNERS,
  SSC_PARTNERS_SOURCE_URL,
  SSC_SHARED_PLATFORM_DOMAINS,
  sscOpportunityTitle,
  sscOpportunityTypeKey,
  sscPartnerFit,
  sscSalesInitiative,
  sscTargetRole,
  shouldClaimSscPartner,
  type SscPartner,
} from "@/lib/sales/seed/seattle-sports-partners";
import type { Organization } from "@/lib/sales/types";

export type SeedSeattleSportsPartnersResult = {
  attempted: number;
  createdOrgs: number;
  updatedOrgs: number;
  opportunitiesCreated: number;
  preservedExistingPursuit: number;
  skippedAlreadySeeded: number;
  heldFromAutoPipeline: number;
  errors: Array<{ name: string; error: string }>;
  organizations: Array<{
    id: string;
    name: string;
    created: boolean;
    claimed: boolean;
    opportunityId: string | null;
  }>;
};

async function ensureFanChantOpportunity(
  organization: Organization,
  partner: SscPartner,
  activeCount: number,
  result: SeedSeattleSportsPartnersResult
): Promise<string | null> {
  const title = sscOpportunityTitle(partner);
  const already = await findExistingOpportunityByTitle(organization.id, title);
  if (already) return already.id;
  if (activeCount > 0) return null;
  const createdOpp = await createOpportunity({
    organizationId: organization.id,
    opportunityTypeId: await opportunityTypeId(sscOpportunityTypeKey(partner)),
    title,
    eventOrInitiativeName: "Fan Chant",
    description: sscPartnerFit(partner),
    status: "new",
    targetContactRoleHint: sscTargetRole(partner),
    importMetadata: {
      sscPartner: true,
      sscPartnerLane: partner.lane,
      sscPartnerTiers: partner.tiers,
      sscSourceUrl: SSC_PARTNERS_SOURCE_URL,
    },
  });
  result.opportunitiesCreated += 1;
  return createdOpp.id;
}

const typeIds = new Map<string, string | null>();

async function organizationTypeId(key: string): Promise<string | null> {
  if (!typeIds.has(key)) {
    const row = await findOrganizationTypeByKey(key);
    typeIds.set(key, row?.id ?? null);
  }
  return typeIds.get(key) ?? null;
}

async function opportunityTypeId(key: string): Promise<string | null> {
  const cacheKey = `opp:${key}`;
  if (!typeIds.has(cacheKey)) {
    const row = await findOpportunityTypeByKey(key);
    typeIds.set(cacheKey, row?.id ?? null);
  }
  return typeIds.get(cacheKey) ?? null;
}

/** Name, then unique domain, then explicit aliases. Shared hosts (Marriott, league sites) never match by domain. */
export async function findSeattleSportsPartnerOrganization(partner: SscPartner): Promise<Organization | null> {
  const byName = await findExistingOrganization(partner.name, null);
  if (byName) return byName;

  const domain = extractDomain(partner.websiteUrl);
  if (domain && !SSC_SHARED_PLATFORM_DOMAINS.has(domain)) {
    const byDomain = await findExistingOrganization(partner.name, partner.websiteUrl);
    if (byDomain) return byDomain;
  }

  for (const alias of partner.aliases ?? []) {
    const byAlias = await findExistingOrganization(alias, null);
    if (byAlias) return byAlias;
  }
  return null;
}

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

/**
 * Idempotent upsert of Seattle Sports Commission partners.
 * New rows are held out of the automatic pipeline so the digest does not draft a generic
 * conference email. Existing pursuits keep their initiative and are not given a second opportunity.
 * No contacts and no outreach drafts are created.
 */
export async function seedSeattleSportsPartners(options?: {
  force?: boolean;
}): Promise<SeedSeattleSportsPartnersResult> {
  const force = Boolean(options?.force);
  const result: SeedSeattleSportsPartnersResult = {
    attempted: SEATTLE_SPORTS_PARTNERS.length,
    createdOrgs: 0,
    updatedOrgs: 0,
    opportunitiesCreated: 0,
    preservedExistingPursuit: 0,
    skippedAlreadySeeded: 0,
    heldFromAutoPipeline: 0,
    errors: [],
    organizations: [],
  };

  for (const partner of SEATTLE_SPORTS_PARTNERS) {
    try {
      const existing = await findSeattleSportsPartnerOrganization(partner);
      const prior = (existing?.importMetadata ?? {}) as Record<string, unknown>;
      if (existing && prior.sscPartnersSeeded === true && !force) {
        const desired = sscSalesInitiative(partner);
        const claimed =
          readSalesInitiative(prior) === desired && !existing.isExistingClient && !isDoNotProspect(prior);
        let opportunityId: string | null = null;
        if (claimed) {
          const open = (await listOpportunitiesForOrganization(existing.id)).filter(
            (opp) => opp.status !== "rejected" && opp.status !== "duplicate"
          );
          opportunityId = await ensureFanChantOpportunity(existing, partner, open.length, result);
        }
        result.skippedAlreadySeeded += 1;
        result.organizations.push({
          id: existing.id,
          name: existing.name,
          created: false,
          claimed,
          opportunityId,
        });
        continue;
      }

      const desired = sscSalesInitiative(partner);
      const fit = sscPartnerFit(partner);
      const opportunities = existing ? await listOpportunitiesForOrganization(existing.id) : [];
      const active = opportunities.filter((opp) => opp.status !== "rejected" && opp.status !== "duplicate");
      const currentInitiative = existing ? readSalesInitiative(prior) : null;
      const canClaim = shouldClaimSscPartner({
        exists: Boolean(existing),
        isExistingClient: Boolean(existing?.isExistingClient),
        doNotProspect: Boolean(existing && isDoNotProspect(prior)),
        currentInitiative,
        desiredInitiative: desired,
        activeOpportunityCount: active.length,
      });

      const importMetadata: Record<string, unknown> = {
        ...prior,
        sscPartner: true,
        sscPartnersSeeded: true,
        sscPartnersSeededAt: new Date().toISOString(),
        sscPartnerTiers: partner.tiers,
        sscPartnerLane: partner.lane,
        sscPageLabels: partner.pageLabels ?? [],
        sscSourceUrl: SSC_PARTNERS_SOURCE_URL,
        sscFit: fit,
      };
      if (canClaim) {
        importMetadata.salesInitiative = desired;
        delete importMetadata.sscSponsorCandidate;
      } else {
        importMetadata.sscSponsorCandidate = true;
      }

      let organization: Organization;
      let created = false;
      if (!existing) {
        importMetadata.holdAutoPipeline = true;
        importMetadata.holdAutoPipelineReason = "ssc_partner_prospect";
        organization = await createOrganization({
          name: partner.name,
          websiteUrl: partner.websiteUrl,
          locationCity: partner.locationCity ?? "Seattle",
          locationRegion: "WA",
          locationCountry: "US",
          organizationTypeId: await organizationTypeId(partner.organizationTypeKey),
          source: "manual",
          isExistingClient: false,
          importMetadata,
        });
        created = true;
        result.createdOrgs += 1;
        result.heldFromAutoPipeline += 1;
      } else {
        organization = await updateOrganization(existing.id, {
          websiteUrl: blank(existing.websiteUrl) ? partner.websiteUrl : existing.websiteUrl,
          locationCity: blank(existing.locationCity) ? partner.locationCity ?? "Seattle" : existing.locationCity,
          locationRegion: blank(existing.locationRegion) ? "WA" : existing.locationRegion,
          locationCountry: blank(existing.locationCountry) ? "US" : existing.locationCountry,
          organizationTypeId:
            existing.organizationTypeId ?? (await organizationTypeId(partner.organizationTypeKey)),
          importMetadata,
        });
        result.updatedOrgs += 1;
        if (!canClaim) result.preservedExistingPursuit += 1;
      }

      const opportunityId = canClaim
        ? await ensureFanChantOpportunity(organization, partner, active.length, result)
        : null;

      result.organizations.push({
        id: organization.id,
        name: organization.name,
        created,
        claimed: canClaim,
        opportunityId,
      });
    } catch (err) {
      result.errors.push({
        name: partner.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

export async function getSeattleSportsPartnersSeedStatus(): Promise<{
  expected: number;
  present: number;
  markedSeeded: number;
  done: boolean;
  organizations: Array<{ name: string; present: boolean; markedSeeded: boolean; lane: SscPartner["lane"] }>;
}> {
  const organizations: Array<{ name: string; present: boolean; markedSeeded: boolean; lane: SscPartner["lane"] }> =
    [];
  for (const partner of SEATTLE_SPORTS_PARTNERS) {
    const existing = await findSeattleSportsPartnerOrganization(partner);
    const meta = (existing?.importMetadata ?? {}) as Record<string, unknown>;
    organizations.push({
      name: partner.name,
      present: Boolean(existing),
      markedSeeded: Boolean(existing && meta.sscPartnersSeeded === true),
      lane: partner.lane,
    });
  }
  const present = organizations.filter((org) => org.present).length;
  const markedSeeded = organizations.filter((org) => org.markedSeeded).length;
  return {
    expected: SEATTLE_SPORTS_PARTNERS.length,
    present,
    markedSeeded,
    done: markedSeeded === SEATTLE_SPORTS_PARTNERS.length,
    organizations,
  };
}
