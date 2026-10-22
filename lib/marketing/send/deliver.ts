import { personalizeEmail } from "../render/personalize";
import type { EmailDocument } from "../document/types";
import type { OutboundEmail } from "../providers/types";
import { liveUnsubscribeToken, testUnsubscribeToken, unsubscribeUrl } from "../unsubscribe";
import type { PreparedSend } from "./prepare";
import { siteUrl } from "../../site-url";

export function formatFrom(name: string, email: string): string {
  const clean = name.replace(/[<>"]/g, "").trim() || "Crowdsource Choir";
  return `${clean} <${email.trim()}>`;
}

export function testSubject(subject: string): string {
  return `[TEST] ${subject}`;
}

export function listHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function messageForRecipient(input: {
  prepared: PreparedSend;
  to: string;
  firstName?: string | null;
  displayName?: string | null;
  city?: string | null;
  unsubscribe: string;
  subject: string;
  idempotencyKey: string;
}): OutboundEmail {
  const personalized = personalizeEmail(
    { html: input.prepared.html, text: input.prepared.text },
    {
      first_name: input.firstName,
      display_name: input.displayName,
      city: input.city,
      email: input.to,
      unsubscribe_url: input.unsubscribe,
    },
    input.prepared.document.personalization
  );
  return {
    idempotencyKey: input.idempotencyKey,
    to: input.to,
    from: formatFrom(input.prepared.fromName, input.prepared.fromEmail),
    replyTo: input.prepared.replyTo,
    subject: input.subject,
    html: personalized.html,
    text: personalized.text,
    headers: listHeaders(input.unsubscribe),
  };
}

export function testUnsubscribeLink(to: string): string {
  const origin = siteUrl();
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim();
  if (!secret) return `${origin}/api/marketing/unsubscribe?preview=test`;
  return unsubscribeUrl(origin, testUnsubscribeToken(to, secret));
}

export function liveUnsubscribeLink(personId: string, subscriptionId: string): string {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim();
  if (!secret) {
    throw new Error("Set MARKETING_UNSUBSCRIBE_SECRET before mailing the list. Nothing was mailed.");
  }
  return unsubscribeUrl(siteUrl(), liveUnsubscribeToken(personId, subscriptionId, secret));
}

export function documentPersonalization(document: EmailDocument): EmailDocument["personalization"] {
  return document.personalization;
}
