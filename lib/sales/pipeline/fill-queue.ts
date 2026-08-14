import { listAwaitingContactOrganizationIds } from "../db/awaitingContact";
import { getDigestMinScore } from "../digest/config";
import { runPipelineForOrganization, type PipelineRunSummary } from "./run-pipeline";

export type FillQueueSummary = {
  considered: number;
  attempted: number;
  queuedOrAdvanced: number;
  results: {
    organizationId: string;
    priorScore: number;
    status: PipelineRunSummary["status"];
    opportunityIds: string[];
  }[];
  errors: string[];
};

/**
 * Re-run the pipeline on high-scoring `awaiting_contact` orgs so enrichment / deepen can
 * clear the verified-email gate and land them in the approval queue.
 */
export async function fillQueueFromAwaitingContact(limit: number = 10): Promise<FillQueueSummary> {
  const capped = Math.max(1, Math.min(25, Math.floor(limit) || 10));
  const minScore = getDigestMinScore();
  const candidates = await listAwaitingContactOrganizationIds(capped, minScore);
  const results: FillQueueSummary["results"] = [];
  const errors: string[] = [];
  let queuedOrAdvanced = 0;

  for (const candidate of candidates) {
    try {
      const summary = await runPipelineForOrganization(candidate.organizationId, "reprocess_request");
      results.push({
        organizationId: candidate.organizationId,
        priorScore: candidate.score,
        status: summary.status,
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

  return {
    considered: candidates.length,
    attempted: results.length,
    queuedOrAdvanced,
    results,
    errors,
  };
}
