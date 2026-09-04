import { callStructured } from "../../openai/client";
import { DraftFillSchema } from "../../openai/schemas";
import { listFindingsWithSourcesForOpportunity } from "../../db/research";
import { findApprovedTemplate, createOutreachDraft, listDraftsForOpportunity } from "../../db/outreach";
import { resolveIndustrySegmentIdForOrganization } from "../../db/lookups";
import { estimateDraftConfidence, formatFeedbackFewShots, listRecentAcceptedEditFeedback } from "../../db/feedback";
import { indexFindingsForPrompt, resolveFindingIds } from "../context";
import { contactGreetingName, isSendableContact } from "../../dedupe";
import { PERSONA_STRATEGIES } from "../../outreach/persona";
import { bookUrl, replaceAttachmentInTemplate, replaceAttachmentWithBookLink } from "../../outreach/bookUrl";
import { SPORTS_VOICE_REFERENCE_EMAILS } from "../../outreach/sports-voice";
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
Hi J.,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. I wanted to reach out because I think it could be a particularly natural fit for the World Education Congress.

We create experiences that move people from being an audience to actually participating and creating something together. Attendees contribute their voices and ideas, and we bring those contributions together into an original anthem that the whole room performs.

For a gathering of people who think deeply about how we convene, engage, and include people, I think there's something especially relevant about experiencing that kind of participation firsthand.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book

If it feels like it could be a fit, I'd love to schedule a quick call and learn more. And if you're not the right person for programming, I'd be grateful if you could point me toward whoever is.

Thanks, and I hope we have a chance to connect.

Best,
Joel

${SPORTS_VOICE_REFERENCE_EMAILS}`;

const SYSTEM_PROMPT = `You fill in three fields (subject, openingReason, fitReason) inside a fixed outreach email template — you do not write a full free-form email, and you do not write the greeting, sign-off, or closing ask, those are already fixed elsewhere. Match the voice of the real emails below exactly: warm but plain-spoken, never salesy, no corporate throat-clearing.

For conference/association prospects, prefer EXAMPLES 1–2. For sports / team / athletics / fan-culture prospects, prefer the SPORTS EXAMPLES (belonging with the fan base, training camp / game-day / season-long participation — not “conference theme”).

${VOICE_REFERENCE_EMAILS}

--- YOUR THREE FIELDS, MAPPED TO THAT VOICE ---
- subject: plain and specific. For conferences use "Crowdsource Choir + {Event Name}" (plus sign, not "for the"). For college athletics use "Turn {school} fans into the game-day show". Never clickbait, never a question mark or exclamation point, never generic ("Exciting opportunity!" / "Quick question").
- openingReason plays the role of the bridge sentence right after the fixed self-intro line — e.g. "I wanted to reach out because I think it could be a natural fit for the World Education Congress." Name the specific opportunity/event. 1 sentence.
- fitReason plays the role of the paragraph that follows — describing what actually happens: people move from audience to creating together, contribute voices and ideas, perform an original anthem as a room. 1-3 sentences. Do not pitch "opening session / closing experience / 50 to 5,000+" unless that is already in the findings.

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

  // Named people still need Hunter verified_deliverable. General inboxes (info@ / events@)
  // are sendable without that bar because catch-all domains usually come back risky/accept_all.
  if (!isSendableContact(contact)) {
    return {
      output: {
        draftId: null,
        skippedReason: `Contact "${contact.fullName ?? "unnamed"}" has no verified email yet (status: ${contact.emailVerificationStatus}) — drafting skipped until verified.`,
      },
    };
  }

  const existingDrafts = await listDraftsForOpportunity(opportunity.id);
  const openForContact = existingDrafts.find(
    (d) =>
      d.kind === "initial" &&
      d.contactId === contact.id &&
      (d.status === "draft" || d.status === "qa_flagged" || d.status === "qa_passed")
  );
  if (openForContact) {
    return {
      output: { draftId: openForContact.id, skippedReason: "Open initial draft already exists for this contact." },
    };
  }
  const alreadySent = existingDrafts.find(
    (d) =>
      d.kind === "initial" &&
      d.contactId === contact.id &&
      (d.status === "approved" || d.status === "approved_with_edits")
  );
  if (alreadySent) {
    return {
      output: {
        draftId: alreadySent.id,
        skippedReason: "Initial outreach already approved for this contact — not reminting a duplicate draft.",
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

  const contactFirstName = contactGreetingName(contact);
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
