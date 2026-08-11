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
import type { Contact, Organization, Opportunity } from "../../types";
import type { BriefStageOutput } from "./brief";

export type DraftStageOutput = {
  draftId: string | null;
  skippedReason: string | null;
};

const SALES_SENDER_NAME = process.env.SALES_SENDER_NAME || "Joel DeJong";

// Real emails Joel has actually sent, used as few-shot voice reference below — abstract style
// adjectives ("less salesy") steer an LLM far worse than concrete examples of the real voice. If
// this voice drifts (new signature, new phrasing habits), update these two examples rather than
// hand-tuning the prose rules further; the examples do most of the work.
const VOICE_REFERENCE_EMAILS = `--- EXAMPLE 1 ---
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

--- EXAMPLE 2 ---
Hi Samantha,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir—a participatory musical experience where the audience becomes the choir. I thought it might be a unique fit for the 2027 INSPIRE Annual Conference.

Unlike a traditional keynote or performance, Crowdsource Choir transforms attendees from spectators into participants. Together, they create something that could only exist because of the unique combination of people in the room. Instead of simply hearing the conference message, they become the message.

Each engagement is custom-designed for the event. Before the conference, attendees contribute stories, ideas, and voices that become the creative source material for a custom anthem and participatory musical experience, premiered together live during the event. The format is flexible and can serve as an opening session, closing experience, experiential keynote, featured performance, or interactive general session for audiences of 50 to 5,000+.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book
If it resonates, I'd love to connect and explore whether Crowdsource Choir might fit your conference.

Thanks for your time, and I hope we have a chance to connect.

Best,
Joel DeJong`;

const SYSTEM_PROMPT = `You fill in three fields (subject, openingReason, fitReason) inside a fixed outreach email template — you do not write a full free-form email, and you do not write the greeting, sign-off, or closing ask, those are already fixed elsewhere. Match the voice of the two real emails below exactly: warm but plain-spoken, never salesy, no corporate throat-clearing.

${VOICE_REFERENCE_EMAILS}

--- YOUR THREE FIELDS, MAPPED TO THAT VOICE ---
- subject: plain and specific, naming the organization or opportunity (e.g. "Crowdsource Choir for the CAIS Trustee/School Head Conference"), never clickbait, never a question mark or exclamation point, never generic ("Exciting opportunity!" / "Quick question").
- openingReason plays the role of the bridge sentence right after the fixed self-intro line — e.g. "I wanted to reach out because I think Crowdsource Choir could be a unique way to bring the CAIS Trustee/School Head Conference theme to life" or "I thought it might be a unique fit for the 2027 INSPIRE Annual Conference." Name the specific opportunity/event. 1 sentence.
- fitReason plays the role of the paragraph that follows — describing what actually happens and why it fits THIS opportunity specifically, in the same grounded-but-vivid register as "Together, attendees co-create and sing an original anthem..." or the "Unlike a traditional keynote..." paragraph. 1-3 sentences.

Rules:
- Describing Crowdsource Choir's own format vividly (e.g. "transforms attendees from spectators into participants") is not a claim that needs evidence — that's our own pitch, not a statement about the prospect. Say it with the same confidence as the reference emails.
- Any claim specifically ABOUT the prospect organization or their event (attendance size, dates, program details, budget signals) must be something the findings actually say — never invent or infer beyond what's given.
- No fabricated familiarity beyond what's already in the fixed template (the greeting itself is handled separately) — never imply a prior relationship, conversation, or meeting that didn't happen.
- No flattery for its own sake ("your impressive organization"), no generic filler, no private/sensitive information.
- Never use email-cliché phrasing: "reaching out to explore synergies," "excited to connect," "circle back," "leverage," "seamless," "game-changer," "revolutionize," or similar. The reference emails never use language like this — match that plainness.
- fitReason should build toward the stated primary goal for this contact's role — the closing ask (supplied separately, not written by you) targets that same goal, so fitReason should set it up rather than argue for a different one.
- CRITICAL: cite findings ONLY via the separate personalizationFindingIndexes field. NEVER write citation markers, finding numbers, or phrases like "(findings 7, 10)", "[8]", or "as noted in findings" inside openingReason or fitReason themselves — those fields are the literal visible email text a human will read, not a footnoted document.`;

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
      limit: 5,
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
