import { getOrganization } from "../db/organizations";
import { listContactsForOrganization } from "../db/contacts";
import { listOpportunitiesForOrganization } from "../db/opportunities";
import { createPipelineRun, finishAgentRun, startAgentRun, updatePipelineRun } from "../db/pipeline";
import { listFindingsForOrganization } from "../db/research";
import { getLatestScoreForOpportunity } from "../db/scores";
import { looksLikePersonName, isSendableContact } from "../dedupe";
import { ensureBookLinks } from "../outreach/ensureBookLinks";
import { claimLooksLikeCalendarDate } from "../research/extractEventDates";
import type { Contact, PipelineStage } from "../types";

import { runNormalizeStage } from "./stages/normalize";
import { runResearchStage } from "./stages/research";
import {
  DEEPEN_MAX_SCORE,
  DEEPEN_MIN_SCORE,
  type DeepenFocus,
  runDeepenResearchPass,
} from "./stages/deepenResearch";
import { runDetectOpportunitiesStage } from "./stages/detectOpportunities";
import { runDiscoverContactsStage } from "./stages/discoverContacts";
import { runEnrichContactsStage } from "./stages/enrichContacts";
import { runVerifyContactsStage } from "./stages/verifyContacts";
import { runScoreStage } from "./stages/score";
import { runBriefStage } from "./stages/brief";
import { runDraftStage } from "./stages/draft";
import { runQaStage } from "./stages/qa";
import { runQueueStage } from "./stages/queue";

async function organizationHasCalendarEventDate(organizationId: string): Promise<boolean> {
  const findings = await listFindingsForOrganization(organizationId);
  return findings.some(
    (f) =>
      f.claimType === "event_date" &&
      claimLooksLikeCalendarDate(
        `${f.claimText} ${typeof f.claimValue === "object" && f.claimValue && "text" in f.claimValue ? String((f.claimValue as { text?: unknown }).text ?? "") : ""}`
      )
  );
}

function missingInfoSuggestsDateGap(missingInformation: string[]): boolean {
  return missingInformation.some((m) => /\b(date|dates|timing|schedule|when|calendar)\b/i.test(m));
}

export type PipelineRunSummary = {
  pipelineRunId: string | null;
  status: "succeeded" | "failed" | "partially_failed" | "skipped_existing_client";
  stagesRun: { stage: PipelineStage; status: string; error?: string }[];
  opportunityIds: string[];
};

/**
 * Prefers an actual named human being over a generic mailbox. Sendable contacts (Hunter-verified
 * people, or general inboxes like info@ / events@) outrank contacts we cannot send to, so a
 * shared inbox can still reach the queue when no named person is verified yet.
 */
function pickBestContact(contacts: Contact[]): Contact | null {
  const emailRank = (c: Contact) =>
    ({ verified_deliverable: 0, valid_format: 1, risky: 2, unverified: 3, invalid: 4 })[c.emailVerificationStatus] ?? 3;
  const rank = (c: Contact) =>
    (isSendableContact(c) ? 0 : 20) + (looksLikePersonName(c.fullName) ? 0 : 10) + emailRank(c);
  const withName = contacts.filter((c) => c.fullName);
  if (withName.length === 0) return null;
  return [...withName].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Runs the fixed 11-stage pipeline (minus hubspot_sync, which only fires on human approval —
 * see docs/sales-platform/ai-workflow.md §11) for one organization, start to finish. Each
 * stage is a separate agent_runs row; a failure at one stage halts only what depends on it,
 * not the whole run (see docs/sales-platform/ai-workflow.md failure-isolation notes per stage).
 */
export async function runPipelineForOrganization(
  organizationId: string,
  trigger: "manual" | "cron" | "reprocess_request" = "manual"
): Promise<PipelineRunSummary> {
  const org = await getOrganization(organizationId);
  if (!org) throw new Error(`Organization ${organizationId} not found.`);

  // Never spend a single AI call or dollar prospecting an organization already marked as a
  // customer — checked before creating any pipeline_run row at all, not just before queueing.
  if (org.isExistingClient) {
    return { pipelineRunId: null, status: "skipped_existing_client", stagesRun: [], opportunityIds: [] };
  }

  // Cheap idempotent repair: stale templates/drafts that still say "I've attached..." get the
  // /book link before this run drafts anything new.
  try {
    await ensureBookLinks();
  } catch {
    // Non-fatal — draft stage also sanitizes attachment wording per email.
  }

  const pipelineRun = await createPipelineRun(organizationId, trigger);
  const stagesRun: PipelineRunSummary["stagesRun"] = [];
  let hadFailure = false;

  async function runStage<T>(stage: PipelineStage, input: unknown, fn: () => Promise<{ output: T; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }>): Promise<T | null> {
    await updatePipelineRun(pipelineRun.id, { currentStage: stage });
    const agentRun = await startAgentRun(pipelineRun.id, stage, input);
    try {
      const result = await fn();
      await finishAgentRun(agentRun.id, {
        status: "succeeded",
        output: result.output as never,
        model: result.model,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costUsd: result.costUsd,
      });
      stagesRun.push({ stage, status: "succeeded" });
      return result.output;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await finishAgentRun(agentRun.id, { status: "failed", error: message });
      stagesRun.push({ stage, status: "failed", error: message });
      hadFailure = true;
      return null;
    }
  }

  // Stage 1 — normalization. Failure here blocks everything downstream.
  const normalizeResult = await runStage("normalize", { organizationId }, () => runNormalizeStage(org));
  if (!normalizeResult) {
    await updatePipelineRun(pipelineRun.id, { status: "failed", finishedAt: new Date().toISOString() });
    return { pipelineRunId: pipelineRun.id, status: "failed", stagesRun, opportunityIds: [] };
  }
  const freshOrg = (await getOrganization(organizationId)) ?? org;

  // Stage 2 — research. Partial failure is acceptable; continue with whatever was found.
  const researchResult = await runStage("research", { organizationId }, () => runResearchStage(freshOrg, pipelineRun.id));

  // Stage 3 — opportunity detection. Even on failure, proceed with whatever opportunities already existed.
  await runStage("detect_opportunity", { organizationId }, () => runDetectOpportunitiesStage(freshOrg, pipelineRun.id));
  const opportunities = await listOpportunitiesForOrganization(organizationId);

  if (opportunities.length === 0) {
    await updatePipelineRun(pipelineRun.id, {
      status: hadFailure ? "failed" : "succeeded",
      finishedAt: new Date().toISOString(),
    });
    return { pipelineRunId: pipelineRun.id, status: hadFailure ? "failed" : "succeeded", stagesRun, opportunityIds: [] };
  }

  // Stage 4 — contact discovery (org-level).
  await runStage("find_contact", { organizationId }, () =>
    runDiscoverContactsStage(freshOrg, researchResult?.namedPeopleMentioned ?? [])
  );

  // Stage 4.5 — contact email enrichment (org-level, Phase 2, no-op unless an API key is configured).
  await runStage("enrich_contact", { organizationId }, () => runEnrichContactsStage(freshOrg));

  // Stage 5 — contact verification (org-level). Runs after enrichment so a newly-found email gets verified too.
  await runStage("verify_contact", { organizationId }, () => runVerifyContactsStage(freshOrg));

  const contacts = await listContactsForOrganization(organizationId);
  let bestContact = pickBestContact(contacts);

  // A human decision is final — re-running the pipeline (e.g. to refresh research on other
  // opportunities for this org) must never re-score/re-draft/re-queue an opportunity a human
  // already approved, rejected, deferred, or otherwise decided on. "awaiting_contact" is also
  // undecided (a human hasn't seen it yet) so a later re-run — e.g. once enrichment finds a
  // verified email — naturally picks it back up and lets it proceed to the queue.
  const UNDECIDED_STATUSES = new Set(["new", "researching", "awaiting_contact", "ready_for_review"]);
  const undecidedOpportunities = opportunities.filter((o) => UNDECIDED_STATUSES.has(o.status));

  // Gate: an opportunity only reaches the human review queue once it has at least one
  // sendable contact (a Hunter-verified named person, or a general inbox like info@ / events@).
  // See docs/sales-platform/ai-workflow.md §4/§10. This reuses the exact same `bestContact`
  // the draft stage uses, so "who we'd draft to" and "who we require to send" never diverge.
  let contactIsQueueReady = bestContact !== null && isSendableContact(bestContact);

  // Stages 6-10 run per opportunity — an organization can have several.
  for (const opportunity of undecidedOpportunities) {
    let scoreResult = await runStage("score", { opportunityId: opportunity.id }, () =>
      runScoreStage(freshOrg, opportunity, pipelineRun.id)
    );
    if (!scoreResult) continue; // no explainable score → don't proceed to brief/draft/queue for this opportunity

    // Search-backed deepen pass (tracked as another `research` agent_runs row), then re-score:
    // (1) near-miss salvage for 45–69 totals, aimed at clearing SALES_DIGEST_MIN_SCORE (70);
    // (2) date-gap fill even above 70 when we still lack a real calendar event date;
    // (3) contact-gap: solid score (≥70) but no verified email yet — chase leadership pages so
    //     enrichment has named people to match (the main reason high scorers stall out of queue).
    const nearMiss =
      scoreResult.totalScore >= DEEPEN_MIN_SCORE && scoreResult.totalScore < DEEPEN_MAX_SCORE;
    const hasCalendarDate = await organizationHasCalendarEventDate(organizationId);
    // Above the digest bar, still chase a real calendar date when research only has a year/name.
    const dateGap =
      !nearMiss &&
      !hasCalendarDate &&
      (scoreResult.totalScore >= DEEPEN_MAX_SCORE || missingInfoSuggestsDateGap(scoreResult.missingInformation));
    const contactGap =
      !nearMiss && !dateGap && !contactIsQueueReady && scoreResult.totalScore >= DEEPEN_MAX_SCORE;
    const deepenFocus: DeepenFocus | null = nearMiss ? "full" : dateGap ? "dates" : contactGap ? "full" : null;

    if (deepenFocus) {
      const deepen = await runStage(
        "research",
        {
          opportunityId: opportunity.id,
          deepen: true,
          deepenFocus,
          contactGap,
          priorScore: scoreResult.totalScore,
          missingInformation: scoreResult.missingInformation,
        },
        () => runDeepenResearchPass(freshOrg, pipelineRun.id, scoreResult!.missingInformation, deepenFocus)
      );
      // Always re-run contact stages after a contact-gap deepen (even if no new people were
      // extracted — enrichment may now succeed on names we already had after a prior provider error).
      if (deepen && (deepen.findingsCreated > 0 || deepen.namedPeopleMentioned.length > 0 || contactGap)) {
        if (deepen.namedPeopleMentioned.length > 0 || contactGap) {
          await runStage("find_contact", { organizationId, afterDeepen: true }, () =>
            runDiscoverContactsStage(freshOrg, deepen.namedPeopleMentioned)
          );
        }
        await runStage("enrich_contact", { organizationId, afterDeepen: true }, () => runEnrichContactsStage(freshOrg));
        await runStage("verify_contact", { organizationId, afterDeepen: true }, () => runVerifyContactsStage(freshOrg));
        const refreshedContacts = await listContactsForOrganization(organizationId);
        bestContact = pickBestContact(refreshedContacts);
        contactIsQueueReady = bestContact !== null && isSendableContact(bestContact);
        const rescored = await runStage("score", { opportunityId: opportunity.id, rescoreAfterDeepen: true }, () =>
          runScoreStage(freshOrg, opportunity, pipelineRun.id)
        );
        if (rescored) scoreResult = rescored;
      }
    }

    const briefResult = await runStage("brief", { opportunityId: opportunity.id }, async () => {
      const score = await getLatestScoreForOpportunity(opportunity.id);
      if (!score) throw new Error("Score not found for brief stage.");
      return runBriefStage(freshOrg, opportunity, score);
    });
    if (!briefResult) continue;

    // draft.ts itself enforces the verified-contact bar (not just "a contact exists") before
    // spending an LLM call — see the comment there for why.
    const draftResult = await runStage("draft", { opportunityId: opportunity.id }, () =>
      runDraftStage(freshOrg, opportunity, bestContact, briefResult, pipelineRun.id)
    );

    if (draftResult?.draftId) {
      await runStage("qa", { draftId: draftResult.draftId }, () => runQaStage(draftResult.draftId as string));
    }

    // The queue stage itself decides, based on contactIsQueueReady, whether to create an
    // approval_queue_items row or just mark the opportunity awaiting_contact — see queue.ts.
    // Always running it through runStage (rather than branching around it here) keeps the same
    // agent_runs tracking and failure isolation as every other stage.
    await runStage("queue", { opportunityId: opportunity.id }, () =>
      runQueueStage(freshOrg, opportunity, scoreResult.prospectScoreId, draftResult?.draftId ?? null, contactIsQueueReady)
    );
  }

  await updatePipelineRun(pipelineRun.id, {
    status: hadFailure ? "partially_failed" : "succeeded",
    currentStage: null,
    finishedAt: new Date().toISOString(),
  });

  return {
    pipelineRunId: pipelineRun.id,
    status: hadFailure ? "partially_failed" : "succeeded",
    stagesRun,
    opportunityIds: opportunities.map((o) => o.id),
  };
}
