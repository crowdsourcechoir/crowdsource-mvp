import { draftToEmailHtml, draftToPlainText, looksLikeHtml } from "@/lib/sales/outreach/email-body-format";

/** RFC 2047 encode Subject so em dashes / curly quotes don't mojibake in clients. */
export function encodeSubjectHeader(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function uniqueBoundary(explicit?: string): string {
  if (explicit) return explicit;
  return `csc_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * multipart/alternative so Gmail shows real bullets/numbers while plain-text
 * clients still get markdown-style lists.
 */
export function buildGmailMime(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string | null;
  references?: string | null;
  boundary?: string;
}): string {
  const boundary = uniqueBoundary(input.boundary);
  const html = input.htmlBody ?? draftToEmailHtml(input.body);
  const plain = looksLikeHtml(input.body) ? draftToPlainText(input.body) : input.body;
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubjectHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    plain,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`,
  ];

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
