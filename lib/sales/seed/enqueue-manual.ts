import { createOpportunity, findExistingOpportunityByTitle, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { createPipelineRun, updatePipelineRun } from "@/lib/sales/db/pipeline";
import { createProspectScore } from "@/lib/sales/db/scores";
import { createOutreachDraft, listDraftsForOpportunity, updateDraftAiCopy } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import { listContactsForOrganization } from "@/lib/sales/db/contacts";
import { findOpportunityTypeByKey } from "@/lib/sales/db/lookups";
import { looksLikePersonName, hasVerifiedEmail } from "@/lib/sales/dedupe";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { buildSeahawksEmail } from "@/lib/sales/outreach/sports-voice";
import { computeTotalScore } from "@/lib/sales/scoring/score";
import { SCORE_COMPONENT_KEYS, type Contact, type Organization, type OutreachDraft, type ScoreComponentKey } from "@/lib/sales/types";

/** Operator-only role blurbs must never ship in the email body (queue UI still shows them). */
const CONTACT_CONTEXT_IN_EMAIL = /\(Context on your seat:/i;

export type ManualEnqueueResult = {
  opportunityId: string;
  queueItemId: string;
  prospectScoreId: string;
  outreachDraftId: string;
  primaryContactId: string | null;
  draftCount: number;
  totalScore: number;
};

function readyContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(
    (c) =>
      looksLikePersonName(c.fullName) &&
      hasVerifiedEmail(c) &&
      c.email &&
      !isOutboundEmailBlocked(c.email)
  );
}

function isConferenceType(opportunityTypeKey?: string | null): boolean {
  return opportunityTypeKey === "annual_conference" || opportunityTypeKey === "association_convention";
}

function isFundraiserType(opportunityTypeKey?: string | null): boolean {
  return opportunityTypeKey === "fundraising_gala";
}

function fanLabelFromOrgName(orgName: string): string {
  return orgName
    .replace(/\b(university|college|athletics|athletic department)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || orgName;
}

function conferenceEventName(orgName: string, eventName?: string | null): string {
  const event = (eventName ?? "").trim();
  return event || `${orgName} annual conference`;
}

function conferenceDraft(firstName: string, event: string): { subject: string; body: string } {
  return {
    subject: `Crowdsource Choir + ${event}`,
    body: `Hi ${firstName},\n\nI hope you're doing well!\n\nI'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. I wanted to reach out because I think it could be a natural fit for ${event}.\n\nWe create experiences that move people from being an audience to actually creating something together. Attendees contribute their voices and ideas, and we bring those contributions together into an original anthem that the whole room performs.\n\nI've included a bit more about the experience here:\nhttps://www.crowdsourcechoir.com/book\n\nIf it feels like it could be a fit, I'd love to connect. If this year is already set, I'd be glad to talk about next year — or connect with whoever handles programming.\n\nThanks, ${firstName}!\n\nBest,\nJoel`,
  };
}

function fundraiserDraft(firstName: string, orgName: string, event: string): { subject: string; body: string } {
  return {
    subject: `Crowdsource Choir + ${event}`,
    body: `Hi ${firstName},\n\nI hope you're doing well!\n\nI'm Joel DeJong, founder of Crowdsource Choir — a participatory musical experience where the audience becomes the choir. I wanted to reach out because I think it could be a natural fit for ${event}.\n\nFor a room that's already gathered around a cause, this is a way to stop being an audience and actually create something together — an original anthem for ${orgName} that the whole night performs. It can sit as an opening, a live moment mid-program, or a close that people leave humming.\n\nI've included a bit more about the experience here:\nhttps://www.crowdsourcechoir.com/book\n\nIf it feels like it could be a fit, I'd love to connect — or be pointed to whoever produces the event.\n\nThanks, ${firstName}!\n\nBest,\nJoel`,
  };
}

function collegeAthleticsDraft(firstName: string, orgName: string): { subject: string; body: string } {
  const fan = fanLabelFromOrgName(orgName);
  return {
    subject: `Turn ${fan} fans into the game-day show`,
    body: `Hi ${firstName},\n\nI think there could be a great fit between Crowdsource Choir and ${fan} basketball. We create participatory entertainment that harnesses the energy and creativity already in a fanbase and turns it into original chants, anthems, and game-day moments.\n\nBetween games: Students and fans contribute voices, sounds, and chant ideas through our digital Chant Garden.\nGame day: We turn those contributions into original ${fan} chants and participatory moments that your team can run in-game—or Crowdsource Choir can lead live in the arena.\nAcross the season: The strongest moments grow into a catalogue of fan-created chants that can become part of the culture and take on a life of their own.\n\nIt's a season-long participation loop designed to build energy, belonging, and new traditions with the fanbase.\n\nI'd love to connect and explore what this could look like at ${fan}. If there's someone else on your team I should connect with, I'd appreciate you pointing me their way.\n\nBest,\nJoel`,
  };
}

/** Prefer programming/events contacts for conferences; entertainment/marketing for sports. */
function pickPrimaryContact(
  contacts: Contact[],
  opportunityTypeKey?: string | null
): Contact | null {
  const ready = readyContacts(contacts);
  if (ready.length === 0) return null;
  const rank = (c: Contact) => {
    const title = `${c.roleTitle ?? ""} ${c.roleCategory ?? ""}`.toLowerCase();
    if (isConferenceType(opportunityTypeKey)) {
      if (/show director|conference programming|event programming|content and programming|event strategy/.test(title))
        return 0;
      if (/events?|conference|meetings|programming|experience/.test(title)) return 1;
      if (/marketing|content/.test(title)) return 2;
      return 5;
    }
    if (/game entertainment|special events|entertainment experience/.test(title)) return 0;
    if (/marketing/.test(title)) return 1;
    if (/coo|chief operating/.test(title)) return 2;
    return 5;
  };
  return [...ready].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function draftCopyForContact(
  orgName: string,
  contact: Contact,
  opts?: { opportunityTypeKey?: string | null; eventName?: string | null }
): { subject: string; body: string } {
  const firstName = (contact.fullName ?? "there").split(/\s+/)[0];
  if (/seahawk/i.test(orgName)) {
    return buildSeahawksEmail({ firstName, roleTitle: contact.roleTitle });
  }

  if (isFundraiserType(opts?.opportunityTypeKey) || /\bgala\b/i.test(opts?.eventName ?? "")) {
    return fundraiserDraft(firstName, orgName, conferenceEventName(orgName, opts?.eventName));
  }

  if (isConferenceType(opts?.opportunityTypeKey)) {
    return conferenceDraft(firstName, conferenceEventName(orgName, opts?.eventName));
  }

  if (/\bathletics\b/i.test(orgName)) {
    return collegeAthleticsDraft(firstName, orgName);
  }

  // Non-Seahawks sports: same belonging structure as Joel’s Seahawks emails, club-specific.
  const title = (contact.roleTitle ?? "").toLowerCase();
  let ask =
    `I’d love to connect, share what we’re building, and explore whether there’s a fit with ${orgName} — or be pointed to the right person if that’s someone else.`;
  if (/entertainment|special events|programming|presentation/.test(title)) {
    ask = `Given your work in live entertainment and experience, I’d love to connect and explore how this kind of participation could become part of the ${orgName} experience—not just something fans watch, but something they help create.`;
  } else if (/marketing|fan engagement|brand/.test(title)) {
    ask = `Given your work in marketing, I’m especially interested in how this could become a season-long fan participation story—something supporters help create with the team, rather than another campaign directed at them.\n\nI’d love to connect, share what we’re building, and explore whether there’s a fit.`;
  } else if (/coo|chief operating|operations|athletics director|athletic director/.test(title)) {
    ask = `I’d love to connect, share what we’re building, and see whether there’s a place to explore this with ${orgName}. If someone else is the right person, I’d really appreciate being pointed in their direction.`;
  }
  return {
    subject: `Crowdsourcing a ${orgName} choir`,
    body: `Hi ${firstName},\n\nI’m Joel DeJong, founder of Crowdsource Choir here in Seattle. We design and deliver participatory music experiences, custom anthems, and crowdsourced chants to create energy, resonance, and cohesion within groups.\n\nWith ${orgName}, I see a few connected possibilities:\n\nA participatory music experience with the team (or student-athletes) to create energy and cohesion\nAn original anthem created with fans and brought to life as a game-day moment\nA season-long pipeline of crowdsourced chants and sounds that gives people new ways to contribute\n\nThe throughline is simple: there’s already enormous collective energy in this community. We help harness it into super fun, engaging musical experiences.\n\n${ask}\n\nThere’s a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book\n\nBest,\nJoel`,
  };
}

/** Ensure every email-ready contact has an initial draft; returns drafts and primary draft id. */
export async function ensureContactDrafts(input: {
  organization: Organization;
  opportunityId: string;
  pipelineRunId?: string | null;
  opportunityTypeKey?: string | null;
  eventName?: string | null;
  /**
   * Mint a fresh open draft even if this contact already has an approved/rejected initial
   * (explicit operator remint — e.g. re-add Tyler after a hard-block).
   */
  remintApprovedEmails?: string[];
}): Promise<{ drafts: OutreachDraft[]; primaryDraft: OutreachDraft; primaryContact: Contact }> {
  const remint = new Set(
    (input.remintApprovedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  const contacts = readyContacts(await listContactsForOrganization(input.organization.id));
  if (contacts.length === 0) {
    throw new Error("No named contact with a Hunter-verified deliverable email — cannot enqueue.");
  }
  const primary = pickPrimaryContact(contacts, input.opportunityTypeKey) ?? contacts[0];
  const existing = await listDraftsForOpportunity(input.opportunityId);
  const drafts: OutreachDraft[] = [];

  for (const contact of contacts) {
    const candidates = existing
      .filter((d) => d.kind === "initial" && d.contactId === contact.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const open = candidates.find((d) => d.status === "draft" || d.status === "qa_flagged");
    if (open) {
      const bodyHasContext =
        CONTACT_CONTEXT_IN_EMAIL.test(open.aiBody) ||
        (open.editedBody != null && CONTACT_CONTEXT_IN_EMAIL.test(open.editedBody));
      if (bodyHasContext) {
        const copy = draftCopyForContact(input.organization.name, contact, {
          opportunityTypeKey: input.opportunityTypeKey,
          eventName: input.eventName,
        });
        const clearedEdited = open.editedBody != null && CONTACT_CONTEXT_IN_EMAIL.test(open.editedBody);
        drafts.push(
          await updateDraftAiCopy(open.id, {
            aiSubject: copy.subject,
            aiBody: copy.body,
            clearEdited: clearedEdited,
          })
        );
      } else {
        drafts.push(open);
      }
      continue;
    }
    const emailKey = (contact.email ?? "").trim().toLowerCase();
    const allowRemint = Boolean(emailKey && remint.has(emailKey));
    // Never mint a fresh draft after this contact was already approved/sent — that caused
    // multi-approve loops that re-emailed the same person — unless operator explicitly remints.
    const alreadyHandled = candidates.find(
      (d) =>
        d.status === "approved" || d.status === "approved_with_edits" || d.status === "rejected"
    );
    if (alreadyHandled && !allowRemint) {
      drafts.push(alreadyHandled);
      continue;
    }
    const copy = draftCopyForContact(input.organization.name, contact, {
      opportunityTypeKey: input.opportunityTypeKey,
      eventName: input.eventName,
    });
    const created = await createOutreachDraft({
      opportunityId: input.opportunityId,
      contactId: contact.id,
      pipelineRunId: input.pipelineRunId ?? null,
      kind: "initial",
      status: "draft",
      confidenceScore: 0.55,
      aiSubject: copy.subject,
      aiBody: copy.body,
    });
    drafts.push(created);
  }

  // Prefer an open reminted draft as primary when present (e.g. Tyler re-add).
  const remintedOpen = drafts.find(
    (d) =>
      (d.status === "draft" || d.status === "qa_flagged") &&
      contacts.some(
        (c) => c.id === d.contactId && remint.has((c.email ?? "").trim().toLowerCase())
      )
  );
  const primaryDraft =
    remintedOpen ?? drafts.find((d) => d.contactId === primary.id) ?? drafts[0];
  const primaryContact =
    contacts.find((c) => c.id === primaryDraft.contactId) ?? primary;
  return { drafts, primaryDraft, primaryContact };
}

/**
 * When OpenAI credits are exhausted (or AI detect/score/draft can't run), still put a solid
 * lead with verified contacts into the approval queue for human review — one draft per contact.
 */
export async function enqueueOrgManually(input: {
  organization: Organization;
  title: string;
  description: string;
  eventOrInitiativeName?: string | null;
  opportunityTypeKey?: string;
  totalScoreHint?: number;
  /** Reopen a previously rejected/deferred initial queue row (manual operator action only). */
  reopenDecided?: boolean;
  /** Mint fresh open drafts for these emails even if already approved/sent. */
  remintApprovedEmails?: string[];
}): Promise<ManualEnqueueResult> {
  const contacts = await listContactsForOrganization(input.organization.id);
  const primary = pickPrimaryContact(contacts, input.opportunityTypeKey);
  if (!primary) {
    throw new Error(
      "No named contact with a Hunter-verified deliverable email (excluding hard-blocked addresses) — cannot enqueue."
    );
  }

  const oppType = await findOpportunityTypeByKey(input.opportunityTypeKey ?? "fan_engagement_initiative");
  let opportunity = await findExistingOpportunityByTitle(input.organization.id, input.title);
  if (!opportunity) {
    opportunity = await createOpportunity({
      organizationId: input.organization.id,
      opportunityTypeId: oppType?.id ?? null,
      title: input.title,
      eventOrInitiativeName: input.eventOrInitiativeName ?? null,
      description: input.description,
      status: "ready_for_review",
      targetContactRoleHint: primary.roleTitle,
      importMetadata: { enqueuedManually: true, reason: "ai_pipeline_unavailable_or_requested" },
    });
  } else {
    await updateOpportunityStatus(opportunity.id, "ready_for_review");
  }

  const pipelineRun = await createPipelineRun(input.organization.id, "manual");

  const hint = Math.min(95, Math.max(70, input.totalScoreHint ?? 82));
  const perComponent = Math.round((hint / 100) * 10);
  const raw = {} as Record<ScoreComponentKey, { score: number; rationale: string; findingIds: string[] }>;
  for (const key of SCORE_COMPONENT_KEYS) {
    raw[key] = {
      score: perComponent,
      rationale: `Manual enqueue for ${input.organization.name} (AI scoring unavailable).`,
      findingIds: [],
    };
  }
  raw.decision_maker_access.score = 9;
  raw.contact_quality.score = 9;
  raw.participatory_program_fit.score = 8;
  raw.strategic_value.score = 8;
  const { total, components } = computeTotalScore(raw);

  const score = await createProspectScore({
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
    totalScore: total,
    componentScores: components,
    rationale: `Manual queue entry for ${input.organization.name}: ${readyContacts(contacts).length} verified doorway contacts with role context; pick a contact in the queue to review/edit each draft.`,
    confidence: "medium",
    missingInformation: ["AI research brief not generated — review contact role blurbs and drafts before send."],
    model: "manual",
  });

  const { drafts, primaryDraft, primaryContact } = await ensureContactDrafts({
    organization: input.organization,
    opportunityId: opportunity.id,
    pipelineRunId: pipelineRun.id,
    opportunityTypeKey: input.opportunityTypeKey,
    eventName: input.eventOrInitiativeName,
    remintApprovedEmails: input.remintApprovedEmails,
  });

  const queueItem = await createOrUpdateQueueItem({
    opportunityId: opportunity.id,
    outreachDraftId: primaryDraft.id,
    prospectScoreId: score.id,
    duplicateWarning: false,
    reopenDecided: Boolean(input.reopenDecided),
  });

  await updatePipelineRun(pipelineRun.id, {
    status: "succeeded",
    currentStage: "queue",
    finishedAt: new Date().toISOString(),
  });

  return {
    opportunityId: opportunity.id,
    queueItemId: queueItem.id,
    prospectScoreId: score.id,
    outreachDraftId: primaryDraft.id,
    primaryContactId: primaryContact.id,
    draftCount: drafts.length,
    totalScore: total,
  };
}
