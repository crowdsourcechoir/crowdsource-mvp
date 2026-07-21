import { callStructured } from "../../openai/client";
import { DraftFillSchema } from "../../openai/schemas";
import { listFindingsWithSourcesForOpportunity } from "../../db/research";
import { findApprovedTemplate, createOutreachDraft } from "../../db/outreach";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import { hasVerifiedEmail } from "../../dedupe";
import type { Contact, Organization, Opportunity } from "../../types";
import type { BriefStageOutput } from "./brief";

export type DraftStageOutput = {
  draftId: string | null;
  skippedReason: string | null;
};

const SALES_SENDER_NAME = process.env.SALES_SENDER_NAME || "The Crowdsource Choir team";

const SYSTEM_PROMPT = `You fill in two short fields for a fixed outreach email template — you do not write a full free-form email. Rules:
- No fabricated familiarity: do not open with generic pleasantries like "I hope this message finds you well" or anything implying a prior relationship that doesn't exist.
- No unsupported claims — only state things the findings actually say.
- No excessive flattery, no long generic company description, no private/sensitive information.
- fitReason must explain WHY this may fit, not just assert that it does, in plain prose.
- CRITICAL: cite findings ONLY via the separate personalizationFindingIndexes field. NEVER write citation markers, finding numbers, or phrases like "(findings 7, 10)", "[8]", or "as noted in findings" inside openingReason or fitReason themselves — those fields are the literal visible email text a human will read, not a footnoted document.
Keep each field to 1-2 plain sentences.`;

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? `{{${key}}}`);
}

export async function runDraftStage(
  org: Organization,
  opportunity: Opportunity,
  contact: Contact | null,
  brief: BriefStageOutput,
  pipelineRunId: string
): Promise<{ output: DraftStageOutput; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  if (!contact) {
    return { output: { draftId: null, skippedReason: "No contact identified yet — drafting skipped, not blocked." } };
  }

  // Requiring the same verified-email bar as queue entry (see lib/sales/dedupe.ts#hasVerifiedEmail
  // and run-pipeline.ts) is a deliberate product decision, not just following the queue gate for
  // its own sake: an AI-written email addressed to a contact we can't confirm is deliverable isn't
  // something a human can act on today, so spending an LLM call writing it doesn't pay for itself
  // yet. The alternative (draft anyway, so the body is ready the moment a real email is found) was
  // considered and rejected for v1 — see docs/sales-platform/ai-workflow.md §8. Once verification
  // or enrichment clears this contact, a later pipeline re-run drafts it then, same as queueing.
  if (!hasVerifiedEmail(contact)) {
    return {
      output: {
        draftId: null,
        skippedReason: `Contact "${contact.fullName ?? "unnamed"}" has no verified email yet (status: ${contact.emailVerificationStatus}) — drafting skipped until verified.`,
      },
    };
  }

  const template = await findApprovedTemplate(opportunity.opportunityTypeId);
  if (!template) {
    return { output: { draftId: null, skippedReason: "No approved outreach template available." } };
  }

  const findings = await listFindingsWithSourcesForOpportunity(org.id, opportunity.id);
  const indexed = indexFindingsForPrompt(findings);

  const userContent = [
    `Organization: ${org.name}`,
    `Opportunity: ${opportunity.title}`,
    `Contact: ${contact.fullName ?? "Unknown"}, ${contact.roleTitle ?? "unknown role"}`,
    `Internal brief recommended angle: ${brief.recommendedAngle}`,
    `Findings:\n${indexed.promptText}`,
  ].join("\n\n");

  const result = await callStructured({
    schema: DraftFillSchema,
    schemaName: "draft_fill",
    systemPrompt: SYSTEM_PROMPT,
    userContent,
  });

  const contactFirstName = (contact.fullName ?? "").split(" ")[0] || "there";
  const body = fillTemplate(template.bodyTemplate, {
    contact_first_name: contactFirstName,
    opening_reason: result.parsed.openingReason,
    fit_reason: result.parsed.fitReason,
    opportunity_title: opportunity.title,
    sender_name: SALES_SENDER_NAME,
  });

  void resolveFindingIds(indexed, result.parsed.personalizationFindingIndexes); // kept in agent_runs.output for provenance

  const draft = await createOutreachDraft({
    opportunityId: opportunity.id,
    contactId: contact.id,
    pipelineRunId,
    templateId: template.id,
    aiSubject: result.parsed.subject,
    aiBody: body,
  });

  return {
    output: { draftId: draft.id, skippedReason: null },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
