import { getGmailClient } from "./client";
import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { assertOutboundEmailAllowed } from "@/lib/sales/outreach/send-blocklist";
import { buildGmailMime } from "./mime";

export type GmailSendResult = {
  messageId: string;
  threadId: string;
};

/**
 * Outbound Gmail stays paused until Resume sending (gmail_connections.sends_enabled) or
 * SALES_GMAIL_SENDS_ENABLED=true. SALES_GMAIL_SENDS_ENABLED=false is an emergency kill
 * that wins over the UI toggle. Reconnect OAuth alone does not send.
 */
export async function assertGmailSendsEnabled(): Promise<void> {
  const status = await getGmailConnectionStatus();
  if (!status.sendsEnabled) {
    throw new Error(
      "Gmail outbound sends are paused. Connect Gmail, then click Resume sending on /admin/sales."
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

/**
 * Sends from the connected Gmail account as multipart text+HTML so list markers
 * render as real bullets/numbers. When `threadId` is set, Gmail places the
 * message in that thread (follow-up / nudge).
 */
export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<GmailSendResult> {
  await assertGmailSendsEnabled();
  assertOutboundEmailAllowed(input.to);

  const bundle = await getGmailClient();
  if (!bundle) {
    throw new Error("Gmail is not connected. Connect Gmail on the Sales overview page first.");
  }

  const raw = encodeRawMessage(
    buildGmailMime({
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
