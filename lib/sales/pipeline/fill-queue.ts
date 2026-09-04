import { listAwaitingContactOrganizationIds } from "../db/awaitingContact";
import { clearFailedEnrichmentAttempts, listContactsForOrganization } from "../db/contacts";
import { getOrganization } from "../db/organizations";
import { getDigestMinScore } from "../digest/config";
import { isGenericMailboxEmail } from "../dedupe";
import { getHunterAccountCredits } from "../enrichment/hunter-account";
import { runPipelineForOrganization, type PipelineRunSummary } from "./run-pipeline";

export type FillQueueSummary = {
  considered: number;
  attempted: number;
  queuedOrAdvanced: number;
  enrichmentErrorsCleared: number;
  eventContactsAdded: number;
  credits: {
    beforeUsed: number | null;
    afterUsed: number | null;
    delta: number | null;
    available: number | null;
  };
  results: {
    organizationId: string;
    priorScore: number;
    status: PipelineRunSummary["status"];
    eventContactsAdded: number;
    opportunityIds: string[];
  }[];
  errors: string[];
};

/**
 * Re-run the pipeline on high-scoring `awaiting_contact` orgs. Contact discovery now Hunter-
 * searches for event-team people and general event inboxes (events@, community@, tickets@,
 * info@) so the verified-named-person gate is not the only way into the queue.
 */
export async function fillQueueFromAwaitingContact(limit: number = 10): Promise<FillQueueSummary> {
  const capped = Math.max(1, Math.min(25, Math.floor(limit) || 10));
  const minScore = getDigestMinScore();
  const candidates = await listAwaitingContactOrganizationIds(capped, minScore);
  const orgIds = candidates.map((c) => c.organizationId);
  const enrichmentErrorsCleared = orgIds.length
    ? await clearFailedEnrichmentAttempts(orgIds).catch(() => 0)
    : 0;

  const beforeCredits = await getHunterAccountCredits().catch(() => ({
    creditsUsed: null as number | null,
    creditsAvailable: null as number | null,
  }));

  const results: FillQueueSummary["results"] = [];
  const errors: string[] = [];
  let queuedOrAdvanced = 0;
  let eventContactsAdded = 0;

  for (const candidate of candidates) {
    try {
      const org = await getOrganization(candidate.organizationId);
      const beforeEmails = new Set(
        org
          ? (await listContactsForOrganization(org.id))
              .map((c) => c.email)
              .filter((e): e is string => Boolean(e))
          : []
      );
      const summary = await runPipelineForOrganization(candidate.organizationId, "reprocess_request");
      const afterContacts = org ? await listContactsForOrganization(org.id) : [];
      const hunted = afterContacts.filter(
        (c) => c.email && !beforeEmails.has(c.email) && isGenericMailboxEmail(c.email)
      ).length;
      eventContactsAdded += hunted;
      results.push({
        organizationId: candidate.organizationId,
        priorScore: candidate.score,
        status: summary.status,
        eventContactsAdded: hunted,
        opportunityIds: summary.opportunityIds,
      });
      if (summary.status === "succeeded" || summary.status === "partially_failed") {
        queuedOrAdvanced += 1;
      }
    } catch (err) {
      errors.push(
        `${candidate.organizationId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const afterCredits = await getHunterAccountCredits().catch(() => ({
    creditsUsed: null as number | null,
    creditsAvailable: null as number | null,
  }));
  const beforeUsed = beforeCredits.creditsUsed;
  const afterUsed = afterCredits.creditsUsed;

  return {
    considered: candidates.length,
    attempted: results.length,
    queuedOrAdvanced,
    enrichmentErrorsCleared,
    eventContactsAdded,
    credits: {
      beforeUsed,
      afterUsed,
      delta: beforeUsed == null || afterUsed == null ? null : Math.max(0, afterUsed - beforeUsed),
      available: afterCredits.creditsAvailable,
    },
    results,
    errors,
  };
}
