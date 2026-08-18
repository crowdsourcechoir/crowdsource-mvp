import { z } from "zod";
import { callStructured } from "@/lib/sales/openai/client";
import { SPORTS_VOICE_REFERENCE_EMAILS } from "@/lib/sales/outreach/sports-voice";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

const ImproveDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

const CONFERENCE_VOICE = `--- CONFERENCE EXAMPLE ---
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

/**
 * Rewrite a queue draft in Joel's sent-email voice. Does not send.
 */
export async function improveOutreachDraft(input: {
  subject: string;
  body: string;
  contactFirstName: string;
  contactRoleTitle: string | null;
  organizationName: string;
  opportunityTitle: string;
  initiativeHint?: "sports" | "conference" | "unknown";
}): Promise<{ subject: string; body: string }> {
  const hint =
    input.initiativeHint === "sports"
      ? "This is sports / fan-culture outreach. Prefer the SPORTS examples (belonging, game-day, season-long participation)."
      : input.initiativeHint === "conference"
        ? "This is conference / association outreach. Prefer the conference example (theme, attendees become the choir)."
        : "Infer sports vs conference from the organization and opportunity.";

  const result = await callStructured({
    schema: ImproveDraftSchema,
    schemaName: "improve_draft",
    systemPrompt: `You rewrite cold outreach emails for Joel DeJong / Crowdsource Choir so they match the voice of emails he has actually sent. Return only subject + body.

Voice rules from Joel's real sends:
- First person, plain, warm, not salesy. No "synergies", "excited to connect", "leverage", "game-changer".
- Open with Hi {first name}. Introduce as founder of Crowdsource Choir. Local/personal context when it fits (e.g. "I've been a 12", schools his kids attended) — do not invent personal facts that are not already in the draft or the sports examples.
- For sports: three concrete possibilities (team/camp cohesion, stadium anthem with fans, season-long chants), then a one-line throughline, then a role-specific ask.
- For conferences: name the event, describe attendees co-creating an anthem so they become the message.
- Close with the book URL as www.crowdsourcechoir.com/book (no https) and "Best,\\nJoel" — never include the American Songwriter signature block.
- Keep roughly the same length as Joel's Seahawks emails. Do not add attachments or pricing.

${hint}

${SPORTS_VOICE_REFERENCE_EMAILS}

${CONFERENCE_VOICE}`,
    userContent: [
      `Organization: ${input.organizationName}`,
      `Opportunity: ${input.opportunityTitle}`,
      `Contact first name: ${input.contactFirstName}`,
      `Contact role: ${input.contactRoleTitle ?? "unknown"}`,
      `Current subject:\n${input.subject}`,
      `Current body:\n${stripEmailSignature(input.body)}`,
    ].join("\n\n"),
  });

  return {
    subject: result.parsed.subject.trim(),
    body: stripEmailSignature(result.parsed.body.trim()),
  };
}
