import { z } from "zod";
import { callStructured } from "@/lib/sales/openai/client";
import { SPORTS_VOICE_REFERENCE_EMAILS } from "@/lib/sales/outreach/sports-voice";
import { contactGreetingName } from "@/lib/sales/dedupe";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import { draftToPlainText, coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { contactRoleDescription, fallbackRoleDescription } from "@/lib/sales/contacts/role-description";
import type { QueueItemDetail } from "@/lib/sales/types";

const CustomizeDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

const CONFERENCE_VOICE = `--- CONFERENCE EXAMPLE ---
Subject: Crowdsource Choir + CAIS Trustee/School Head Conference

Hi Lorena,

I hope you're doing well!

I'm Joel DeJong, founder of Crowdsource Choir. All four of my children have attended independent schools, so I've come to really appreciate this community.

I wanted to reach out because I think Crowdsource Choir could be a unique way to bring the CAIS Trustee/School Head Conference theme to life. Together, attendees co-create and sing an original anthem inspired by the conference, transforming the theme into a shared experience that's joyful, memorable, and deeply participatory.

I've included a bit more about the experience here:
https://www.crowdsourcechoir.com/book
If it feels like it could be a fit, I'd love to schedule a quick call and learn more about the conference.

Thanks, and I hope we have a chance to connect.

Best,
Joel`;

export function looksLikeGenericTemplateDraft(body: string): boolean {
  const plain = draftToPlainText(body);
  return (
    /I thought it might be a unique fit for/i.test(plain) ||
    /opening session, closing experience, or interactive general session/i.test(plain) ||
    /a participatory musical experience where the audience becomes the choir/i.test(plain)
  );
}

export function draftNamesWrongOrganization(body: string, organizationName: string): boolean {
  const plain = draftToPlainText(body);
  if (!plain.trim()) return false;
  const org = organizationName.trim();
  if (!org) return false;
  if (new RegExp(org.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(plain)) return false;
  return /With (Pacific Northwest Ballet|the Seahawks|ETHDenver|NAHQ)/i.test(plain);
}

/** First-pass templates that still leak CRM slugs or doubled articles. */
export function draftNeedsTemplateRedraft(body: string, subject: string): boolean {
  const plain = draftToPlainText(body);
  const sub = subject || "";
  return (
    /^With .+\s+—\s+/m.test(plain) ||
    /so the the /i.test(plain) ||
    /Crowdsource Choir \+ the annual /i.test(sub) ||
    /for the annual conference/i.test(plain) ||
    /ballpark ritual|shared-creation anthem/i.test(plain)
  );
}

/**
 * Full rewrite in Joel's sent-mail voice, customized to this org + contact + event.
 * Saves as edited copy later — this function does not send or write to the DB.
 */
export async function customizeOutreachDraft(input: {
  detail: QueueItemDetail;
  sentExamples: string;
}): Promise<{ subject: string; body: string }> {
  const { detail, sentExamples } = input;
  const contact = detail.contact;
  const firstName = contactGreetingName(contact);
  const roleTitle = contact?.roleTitle ?? null;
  const roleBlurb = contactRoleDescription(contact) ?? fallbackRoleDescription(roleTitle, contact?.email);
  const currentSubject = coalesceDraftSubject(detail.draft?.editedSubject, detail.draft?.aiSubject);
  const currentBody = draftToPlainText(
    coalesceDraftBody(detail.draft?.editedBody, detail.draft?.aiBody)
  );
  const findings = (detail.findings ?? [])
    .slice(0, 8)
    .map((f) => `- ${f.claimType}: ${f.claimText}`)
    .join("\n");
  const brief = detail.brief?.summary?.trim() || "";

  const result = await callStructured({
    schema: CustomizeDraftSchema,
    schemaName: "customize_draft",
    systemPrompt: `You rewrite cold outreach for Joel DeJong / Crowdsource Choir so each email is specific to THIS organization, THIS event, and THIS person's role. Return only subject + body. Never send.

Voice — copy the SENT EMAILS and examples below, not the generic template:
- First person, plain, warm. No "synergies", "excited to connect", "leverage", "game-changer", "unique fit".
- Open with Hi {first name} for a named person, or Hi there for a general inbox (info@ / events@). Introduce as founder of Crowdsource Choir.
- Name the real organization and gathering in the body (not a different org from another draft).
- Give 2–3 concrete possibilities tailored to this gathering (opening / shared anthem / ongoing participation — worded for THIS community, not copy-pasted Seahawks "12s" language unless this really is the Seahawks).
- One throughline sentence about THIS community's energy.
- Close with a role-specific ask that uses their title. Then:
There's a little more about Crowdsource Choir here: www.crowdsourcechoir.com/book

Best,
Joel
- Do not invent dates, attendance, themes, or personal facts. If a finding/brief states them, you may use them. If not, stay general.
- Do not include the American Songwriter signature. Do not mention attachments or pricing.
- Keep about the same length as Joel's Seahawks emails.

${sentExamples ? `REAL SENT EMAILS (prefer this voice when it conflicts with older templates):\n${sentExamples}\n` : ""}
${SPORTS_VOICE_REFERENCE_EMAILS}

${CONFERENCE_VOICE}`,
    userContent: [
      `Organization: ${detail.organization.name}`,
      `Opportunity / event: ${detail.opportunity.title}`,
      `Contact: ${firstName === "there" ? "general inbox" : firstName} — ${roleTitle ?? "unknown role"}`,
      `What this person does: ${roleBlurb}`,
      brief ? `Brief:\n${brief}` : "Brief: (none)",
      findings ? `Findings (only use what's here):\n${findings}` : "Findings: (none)",
      `Current subject:\n${currentSubject}`,
      `Current body:\n${stripEmailSignature(currentBody)}`,
    ].join("\n\n"),
  });

  return {
    subject: result.parsed.subject.trim(),
    body: stripEmailSignature(result.parsed.body.trim()),
  };
}
