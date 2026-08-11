import { callStructured } from "../../openai/client";
import { DraftFillSchema } from "../../openai/schemas";
import { listFindingsWithSourcesForOpportunity } from "../../db/research";
import { findApprovedTemplate, createOutreachDraft } from "../../db/outreach";
import { resolveIndustrySegmentIdForOrganization } from "../../db/lookups";
import { estimateDraftConfidence, formatFeedbackFewShots, listRecentAcceptedEditFeedback } from "../../db/feedback";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import { hasVerifiedEmail } from "../../dedupe";
import { PERSONA_STRATEGIES } from "../../outreach/persona";
import { bookUrl, replaceAttachmentInTemplate, replaceAttachmentWithBookLink } from "../../outreach/bookUrl";
import { OUTREACH_GOLD_EDIT_EXAMPLES, OUTREACH_STYLE_LESSONS } from "../../outreach/styleLessons";
import type { Contact, Organization, Opportunity } from "../../types";
import type { BriefStageOutput } from "./brief";

export type DraftStageOutput = {
  draftId: string | null;
  skippedReason: string | null;
};

const SALES_SENDER_NAME = process.env.SALES_SENDER_NAME || "Joel DeJong";

// Real emails Joel has actually sent / approved-with-edits, used as few-shot voice reference.
// Abstract style adjectives steer an LLM worse than concrete examples. Prefer gold edited
// examples (ACE / City Summit) plus earlier CAIS/INSPIRE sends.
const VOICE_REFERENCE_EMAILS = `--- EXAMPLE 1 (earlier send) ---
Hi Lorena,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir. All four of my children have attended independent schools, so I've come to really appreciate this community.

I wanted to reach out because I think Crowdsource Choir could be a unique way to bring the CAIS Trustee/School Head Conference theme to life. Together, attendees co-create and sing an original anthem inspired by the conference, transforming the theme into a shared experience that's joyful, memorable, and deeply participatory.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book
If it feels like it could be a fit, I'd love to schedule a quick call and learn more about the conference.

Thanks, and I hope we have a chance to connect.

Best,
Joel DeJong

${OUTREACH_GOLD_EDIT_EXAMPLES}`;

const SYSTEM_PROMPT = `You fill in three fields (subject, openingReason, fitReason) inside a fixed outreach email template — you do not write a full free-form email, and you do not write the greeting, sign-off, or closing ask, those are already fixed elsewhere. Match the voice of the real / operator-edited emails below exactly: warm but plain-spoken, never salesy, no corporate throat-clearing.

${VOICE_REFERENCE_EMAILS}

${OUTREACH_STYLE_LESSONS}

--- YOUR THREE FIELDS, MAPPED TO THAT VOICE ---
- subject: plain and specific, naming the organization or opportunity (e.g. "Crowdsource Choir for the ACE Annual Meeting"), never clickbait, never a question mark or exclamation point, never generic ("Exciting opportunity!" / "Quick question").
- openingReason plays the role of the bridge sentence right after the fixed self-intro line. Name the specific opportunity/event. Prefer the strongest distinctive hook from the findings (place, theme, Music City, etc.) in this sentence when one exists — 1 sentence.
- fitReason plays the role of the paragraph that follows — what happens (voices → anthem the room performs) and why it fits THIS audience's actual work. 1-3 sentences. Mirror Gold Edit A/B register, not corporate fluff.

Rules:
- Describing Crowdsource Choir's own format vividly is not a claim that needs evidence — that's our own pitch. Say it with the same confidence as the reference emails.
- Any claim specifically ABOUT the prospect organization or their event (attendance size, dates, program details, venue/city, budget signals) must be something the findings actually say — never invent or infer beyond what's given.
- No fabricated familiarity, prior relationship, conversation, meeting, or past partnership with "organizations like yours."
- No flattery for its own sake ("your impressive organization"), no generic filler, no private/sensitive information.
- Never use email-cliché phrasing: "reaching out to explore synergies," "excited to connect," "circle back," "leverage," "seamless," "game-changer," "revolutionize," "fostering deep community engagement," "amplifies the important discussions," or similar.
- fitReason should build toward the stated primary goal for this contact's role — the closing ask (supplied separately) targets that same goal.
- CRITICAL: cite findings ONLY via the separate personalizationFindingIndexes field. NEVER write citation markers, finding numbers, or phrases like "(findings 7, 10)", "[8]", or "as noted in findings" inside openingReason or fitReason themselves.`;

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

  // Resolved segment, not org.industrySegmentId directly — an org with no override still
  // inherits one from its organization_type (see lookups.ts), so this always reflects the same
  // "effective" segment a human reading the org's type would expect.
  const industrySegmentId = await resolveIndustrySegmentIdForOrganization(org);
  const template = await findApprovedTemplate(opportunity.opportunityTypeId, industrySegmentId);
  if (!template) {
    return { output: { draftId: null, skippedReason: "No approved outreach template available." } };
  }

  const strategy = PERSONA_STRATEGIES[contact.outreachPersona];

  const findings = await listFindingsWithSourcesForOpportunity(org.id, opportunity.id);
  const indexed = indexFindingsForPrompt(findings);

  let fewShots = "";
  let confidenceScore: number | null = null;
  try {
    const feedback = await listRecentAcceptedEditFeedback({
      outreachPersona: contact.outreachPersona,
      industrySegmentId,
      limit: 3,
    });
    fewShots = formatFeedbackFewShots(feedback);
    confidenceScore = estimateDraftConfidence(feedback);
  } catch {
    // outreach_feedback may not exist until sales-platform-add-gmail.sql is applied.
  }

  const userContent = [
    `Organization: ${org.name}`,
    `Opportunity: ${opportunity.title}`,
    `Contact: ${contact.fullName ?? "Unknown"}, ${contact.roleTitle ?? "unknown role"}`,
    `Contact's role bucket: ${strategy.label}. Primary goal for this email: ${strategy.primaryGoal}.`,
    `Internal brief recommended angle: ${brief.recommendedAngle}`,
    `Findings:\n${indexed.promptText}`,
    `Reminder: put the strongest distinctive finding (place, theme, Music City, audience job) into openingReason when one exists; use fitReason for voices→anthem→why it fits THIS audience's work.`,
  ].join("\n\n");

  const result = await callStructured({
    schema: DraftFillSchema,
    schemaName: "draft_fill",
    systemPrompt: fewShots ? `${SYSTEM_PROMPT}\n\n${fewShots}` : SYSTEM_PROMPT,
    userContent,
  });

  const contactFirstName = (contact.fullName ?? "").split(" ")[0] || "there";
  // Sanitize before fill so a stale DB template that still says "I've attached..." cannot
  // ship — cold outreach always links to /book (see lib/sales/outreach/bookUrl.ts).
  const body = replaceAttachmentWithBookLink(
    fillTemplate(replaceAttachmentInTemplate(template.bodyTemplate), {
      contact_first_name: contactFirstName,
      opening_reason: result.parsed.openingReason,
      fit_reason: result.parsed.fitReason,
      opportunity_title: opportunity.title,
      sender_name: SALES_SENDER_NAME,
      // Deterministic, not AI-authored — the "ask" always matches the assigned persona strategy
      // exactly, same rationale as the rest of the template-fill approach (see SYSTEM_PROMPT above).
      cta: strategy.cta,
      book_url: bookUrl(),
    })
  );

  void resolveFindingIds(indexed, result.parsed.personalizationFindingIndexes); // kept in agent_runs.output for provenance

  const draft = await createOutreachDraft({
    opportunityId: opportunity.id,
    contactId: contact.id,
    pipelineRunId,
    templateId: template.id,
    kind: "initial",
    aiSubject: result.parsed.subject,
    aiBody: body,
    confidenceScore,
  });

  return {
    output: { draftId: draft.id, skippedReason: null },
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    costUsd: result.costUsd,
  };
}
