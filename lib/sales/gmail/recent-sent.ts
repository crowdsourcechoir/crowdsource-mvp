import { getGmailClient } from "./client";
import { draftToPlainText } from "@/lib/sales/outreach/email-body-format";

export type RecentSentEmail = {
  gmailId: string;
  to: string;
  subject: string;
  body: string;
  internalDate: string | null;
};

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string
): string | null {
  const hit = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return hit?.value ?? null;
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown;
} | null | undefined): string {
  if (!payload) return "";
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) {
    const text = extractTextBody(part as typeof payload);
    if (text.trim()) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function stripQuoted(body: string): string {
  const withoutSignature = body.split(/^\s*--\s*$/m)[0] ?? body;
  const lines = withoutSignature.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:$/.test(line.trim())) break;
    if (line.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function extractEmailAddresses(header: string | null): string[] {
  if (!header) return [];
  const matches = header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return (matches ?? []).map((e) => e.toLowerCase());
}

/**
 * Recent mail Joel actually sent from the connected Gmail account.
 * Used as voice few-shots when rewriting queue drafts. Never sends.
 */
export async function listRecentSentPlainEmails(limit = 12): Promise<RecentSentEmail[]> {
  const bundle = await getGmailClient();
  if (!bundle) return [];

  const list = await bundle.gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: Math.min(20, Math.max(4, limit)),
    q: "from:me -in:chats newer_than:180d",
  });

  const out: RecentSentEmail[] = [];
  for (const stub of list.data.messages ?? []) {
    if (!stub.id) continue;
    const full = await bundle.gmail.users.messages.get({
      userId: "me",
      id: stub.id,
      format: "full",
    });
    const headers = full.data.payload?.headers;
    const to = extractEmailAddresses(headerValue(headers, "To"))[0] ?? "";
    const subject = (headerValue(headers, "Subject") ?? "").trim();
    const body = draftToPlainText(stripQuoted(extractTextBody(full.data.payload ?? null)));
    if (!subject || body.length < 120) continue;
    if (/unsubscribe|noreply/i.test(to)) continue;
    out.push({
      gmailId: stub.id,
      to,
      subject,
      body,
      internalDate: full.data.internalDate ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function formatSentEmailsForPrompt(emails: RecentSentEmail[]): string {
  if (!emails.length) return "";
  return emails
    .slice(0, 8)
    .map((email, i) => `--- SENT EMAIL ${i + 1} ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`)
    .join("\n\n");
}
