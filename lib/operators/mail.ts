import { Resend } from "resend";
import { ownerEmail } from "@/lib/operators/session";
import { siteUrl } from "@/lib/site-url";

/** From-address for invite and reset mail. AUTH_FROM_EMAIL overrides the owner address. */
export function authMailFrom(): string {
  const raw = process.env.AUTH_FROM_EMAIL?.trim() || ownerEmail();
  return raw.includes("<") ? raw : `Crowdsource Choir <${raw}>`;
}

export function authMailReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Null when the Resend key is set. The from-address has a default. */
export function authMailHint(): string | null {
  if (authMailReady()) return null;
  return "Invites and password resets need the Resend key on the server.";
}

export function unverifiedDomainMessage(): string {
  return "crowdsourcechoir.com is not verified in Resend, and Gmail is not connected. Verify the domain at https://resend.com/domains and add the DNS records it shows, or connect Gmail, then send the invite again.";
}

export function isUnverifiedDomainError(message: string): boolean {
  return /domain is not verified/i.test(message);
}

async function sendAuthMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const from = authMailFrom();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !from) {
    throw new Error(authMailHint() || "Invite mail is not configured.");
  }
  const resend = new Resend(key);
  const result = await resend.emails.send({ from, to, subject, text, html });
  if (!result.error) return;
  if (!isUnverifiedDomainError(result.error.message)) throw new Error(result.error.message);
  const { trySendAccessMailViaGmail } = await import("@/lib/sales/gmail/send");
  const sent = await trySendAccessMailViaGmail({ to, subject, text, html });
  if (sent) return;
  throw new Error(unverifiedDomainMessage());
}

export async function sendInviteMail(to: string, name: string, token: string): Promise<void> {
  const link = `${siteUrl()}/invite?token=${encodeURIComponent(token)}`;
  const text = `Hi ${name},\n\nYou have access to Crowdsource Choir. Choose a password to open your room:\n${link}\n\nThis link expires in 7 days.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>You have access to Crowdsource Choir. Choose a password to open your room.</p><p><a href="${link}">Set your password</a></p><p>This link expires in 7 days.</p>`;
  await sendAuthMail(to, "Your Crowdsource Choir access", text, html);
}

export async function sendResetMail(to: string, name: string, token: string): Promise<void> {
  const link = `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `Hi ${name},\n\nChoose a new password for Crowdsource Choir:\n${link}\n\nThis link expires in one hour. If you did not ask for it, you can ignore this email.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Choose a new password for Crowdsource Choir.</p><p><a href="${link}">Reset your password</a></p><p>This link expires in one hour. If you did not ask for it, you can ignore this email.</p>`;
  await sendAuthMail(to, "Reset your Crowdsource Choir password", text, html);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
