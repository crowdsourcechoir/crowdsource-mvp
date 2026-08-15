import { getGmailClient } from "./client";

export type GmailSendResult = {
  messageId: string;
  threadId: string;
};

/**
 * Emergency kill switch (2026-08-15 multi-send incident). Outbound Gmail stays blocked until
 * Vercel has `SALES_GMAIL_SENDS_ENABLED=true`. Disconnecting Gmail is the immediate stop;
 * this keeps sends dead even after someone reconnects by mistake.
 */
export function assertGmailSendsEnabled(): void {
  if (process.env.SALES_GMAIL_SENDS_ENABLED?.trim() !== "true") {
    throw new Error(
      "Gmail outbound sends are paused (SALES_GMAIL_SENDS_ENABLED is not true). Reconnect alone will not send."
    );
  }
}

function encodeRawMessage(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** RFC 2047 encode Subject so em dashes / curly quotes don't mojibake in clients. */
function encodeSubjectHeader(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildRfc822(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubjectHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);
  return `${headers.join("\r\n")}\r\n\r\n${input.body}`;
}

/**
 * Sends a plain-text email from the connected Gmail account. When `threadId` is set, Gmail
 * places the message in that thread (follow-up / nudge).
 */
export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<GmailSendResult> {
  assertGmailSendsEnabled();

  const bundle = await getGmailClient();
  if (!bundle) {
    throw new Error("Gmail is not connected. Connect Gmail on the Sales overview page first.");
  }

  const raw = encodeRawMessage(
    buildRfc822({
      from: bundle.email,
      to: input.to,
      subject: input.subject,
      body: input.body,
      inReplyTo: input.inReplyTo,
      references: input.references,
    })
  );

  const res = await bundle.gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: input.threadId ?? undefined,
    },
  });

  const messageId = res.data.id;
  const threadId = res.data.threadId;
  if (!messageId || !threadId) {
    throw new Error("Gmail send succeeded but returned no message/thread id.");
  }
  return { messageId, threadId };
}

/** Best-effort RFC Message-ID header from a sent message — used for In-Reply-To on nudges. */
export async function getGmailRfcMessageId(gmailMessageId: string): Promise<string | null> {
  const bundle = await getGmailClient();
  if (!bundle) return null;
  const res = await bundle.gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "metadata",
    metadataHeaders: ["Message-ID"],
  });
  const header = res.data.payload?.headers?.find((h) => h.name?.toLowerCase() === "message-id");
  return header?.value ?? null;
}
