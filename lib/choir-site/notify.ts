import { Resend } from "resend";
import { authMailFrom, isUnverifiedDomainError } from "@/lib/operators/mail";
import { ownerEmail } from "@/lib/operators/session";

export function choirInbox(): string {
  return process.env.CHOIR_INBOX?.trim() || ownerEmail();
}

export function mailtoHref(subject: string, body: string): string {
  return `mailto:${choirInbox()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Email Joel. Returns false when Resend is missing or the domain cannot send. */
export async function sendChoirNote(subject: string, text: string, replyTo?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const resend = new Resend(key);
  const result = await resend.emails.send({
    from: authMailFrom(),
    to: choirInbox(),
    subject,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
  if (!result.error) return true;
  if (isUnverifiedDomainError(result.error.message)) return false;
  return false;
}
