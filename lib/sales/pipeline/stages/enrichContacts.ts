import { activeEnrichmentProvider } from "../../enrichment";
import { enrichOrganizationWithHunter } from "../../enrichment/hunter-org-enrich";
import { readSalesInitiative } from "../../initiatives";
import type { Organization } from "../../types";

export type EnrichContactsStageOutput = {
  provider: "apollo" | "hunter" | null;
  attempted: number;
  found: number;
  domainSearchAttempted?: boolean;
  domainSearchAdded?: number;
  creditsDelta?: number;
  skippedNoDomain: boolean;
};

/**
 * Phase 2: fills in missing personal emails for named people via Hunter Email Finder AND,
 * when an org still has no sendable named personal contact (e.g. 0 scraped people or only
 * a weak general inbox like info@ / events@), runs Hunter Domain Search for up to the top 3
 * buyer-fit decision-makers within the ≤3-credit per-org automated cap.
 */
export async function runEnrichContactsStage(org: Organization): Promise<{ output: EnrichContactsStageOutput }> {
  const provider = activeEnrichmentProvider();
  if (!provider) {
    return { output: { provider: null, attempted: 0, found: 0, skippedNoDomain: false } };
  }
  if (!org.domain && !org.websiteUrl) {
    return { output: { provider, attempted: 0, found: 0, skippedNoDomain: true } };
  }

  const enriched = await enrichOrganizationWithHunter(org, {
    verifyExistingNamed: false,
    salesInitiative: readSalesInitiative(org.importMetadata),
  });

  return {
    output: {
      provider,
      attempted: enriched.finderAttempted + (enriched.domainSearchAttempted ? 1 : 0),
      found: enriched.finderFound + enriched.domainSearchAdded,
      domainSearchAttempted: enriched.domainSearchAttempted,
      domainSearchAdded: enriched.domainSearchAdded,
      creditsDelta: enriched.creditsDelta,
      skippedNoDomain: enriched.skippedReason === "no_domain",
    },
  };
}
