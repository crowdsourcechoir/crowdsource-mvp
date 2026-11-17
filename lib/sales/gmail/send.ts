import { getGmailClient } from "./client";
import { getGmailConnection, getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { looksLikeHtml, draftToPlainText } from "@/lib/sales/outreach/email-body-format";
import { assertOutboundEmailAllowed } from "@/lib/sales/outreach/send-blocklist";
import { ensureEmailSignature, ensureEmailSignatureHtml } from "@/lib/sales/outreach/signature";
import { gmailDraftUrl, hasGmailComposeScope } from "./constants";
import { buildGmailMime } from "./mime";

export type GmailSendResult = {
  messageId: string;
  threadId: string;
};

export type GmailDraftResult = {
  draftId: string;
  messageId: string;
  threadId: string;
  draftUrl: string;
};

export type PriorGmailCorrespondence = {
  threadId: string;
  messageId: string;
  sentByUs: boolean;
  occurredAt: string | null;
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

function gmailApiKilled(): boolean {
  return process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "false";
}

function mimeForOutbound(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  html?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): string {
  const plainSource = looksLikeHtml(input.body) ? draftToPlainText(input.body) : input.body;
  const plain = ensureEmailSignature(plainSource);
  const htmlSource = input.html ?? (looksLikeHtml(input.body) ? input.body : null);
  return encodeRawMessage(
    buildGmailMime({
      from: input.from,
      to: input.to,
      subject: input.subject,
      body: plain,
      htmlBody: htmlSource ? ensureEmailSignatureHtml(htmlSource) : undefined,
      inReplyTo: input.inReplyTo,
      references: input.references,
    })
  );
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
  html?: string | null;
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

  const raw = mimeForOutbound({ ...input, from: bundle.email });

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

/**
 * Creates a draft in the connected account's Gmail Drafts folder without sending.
 * Requires `gmail.compose` (`gmail.send` alone cannot call `users.drafts.create`).
 */
export async function createGmailDraft(input: {
  to: string;
  subject: string;
  body: string;
  html?: string | null;
}): Promise<GmailDraftResult> {
  if (gmailApiKilled()) {
    throw new Error("Gmail is disabled by SALES_GMAIL_SENDS_ENABLED=false.");
  }
  assertOutboundEmailAllowed(input.to);

  const connection = await getGmailConnection();
  if (!connection) {
    throw new Error("Gmail is not connected. Connect Gmail on the Sales overview page first.");
  }
  if (!hasGmailComposeScope(connection.scopes)) {
    throw new Error("Gmail is missing permission to create drafts. Reconnect Google and allow Gmail compose.");
  }

  const bundle = await getGmailClient();
  if (!bundle) {
    throw new Error("Gmail is not connected. Connect Gmail on the Sales overview page first.");
  }

  const raw = mimeForOutbound({ ...input, from: bundle.email });
  const res = await bundle.gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  const draftId = res.data.id;
  const messageId = res.data.message?.id;
  const threadId = res.data.message?.threadId;
  if (!draftId || !messageId || !threadId) {
    throw new Error("Gmail draft was created but returned no id.");
  }
  return {
    draftId,
    messageId,
    threadId,
    draftUrl: gmailDraftUrl(threadId, bundle.email),
  };
}

/**
 * Live Gmail check using `gmail.readonly` to catch prior direct-from-Gmail sends or replies
 * that never landed on the candidate opportunity row in Supabase. Ignores unsent drafts, spam, and trash.
 */
export async function findPriorGmailCorrespondence(email: string): Promise<PriorGmailCorrespondence | null> {
  const clean = email.trim().toLowerCase().replace(/["\\\s]/g, "");
  if (!clean || !clean.includes("@")) return null;
  const bundle = await getGmailClient();
  if (!bundle) return null;

  const list = await bundle.gmail.users.messages.list({
    userId: "me",
    q: `(to:"${clean}" OR from:"${clean}" OR cc:"${clean}") -in:chats -in:trash -in:spam`,
    maxResults: 5,
  });

  for (const stub of list.data.messages ?? []) {
    if (!stub.id) continue;
    const msg = await bundle.gmail.users.messages.get({
      userId: "me",
      id: stub.id,
      format: "minimal",
    });
    const labels = msg.data.labelIds ?? [];
    if (labels.includes("DRAFT") || labels.includes("TRASH") || labels.includes("SPAM")) continue;
    const threadId = msg.data.threadId;
    const messageId = msg.data.id;
    if (!threadId || !messageId) continue;
    const internalMs = msg.data.internalDate ? Number(msg.data.internalDate) : NaN;
    return {
      threadId,
      messageId,
      sentByUs: labels.includes("SENT"),
      occurredAt: Number.isFinite(internalMs) ? new Date(internalMs).toISOString() : null,
    };
  }
  return null;
}

/**
 * Mail the operator sends to their own connected mailbox (the morning digest).
 *
 * The Resume-sending pause exists to stop prospect outreach, so it does not gate this path;
 * the recipient is forced to the connected account, so nothing can reach a prospect here.
 * SALES_GMAIL_SENDS_ENABLED=false still kills every Gmail API send.
 */
export async function sendSelfEmailViaGmail(input: {
  subject: string;
  text: string;
  html: string;
}): Promise<GmailSendResult & { to: string }> {
  if (process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "false") {
    throw new Error("Gmail sends are disabled by SALES_GMAIL_SENDS_ENABLED=false.");
  }

  const bundle = await getGmailClient();
  if (!bundle) {
    throw new Error("Gmail is not connected. Connect Gmail on the Sales overview page first.");
  }

  const raw = encodeRawMessage(
    buildGmailMime({
      from: bundle.email,
      to: bundle.email,
      subject: input.subject,
      body: input.text,
      htmlBody: input.html,
    })
  );

  const res = await bundle.gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  const messageId = res.data.id;
  const threadId = res.data.threadId;
  if (!messageId || !threadId) {
    throw new Error("Gmail send succeeded but returned no message/thread id.");
  }
  return { messageId, threadId, to: bundle.email };
}

/**
 * Access mail (invites, password resets) from the connected Gmail account.
 * The Sales pause does not apply. Returns false when Gmail is not connected.
 * SALES_GMAIL_SENDS_ENABLED=false still blocks the send.
 */
export async function trySendAccessMailViaGmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  if (process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "false") return false;
  const bundle = await getGmailClient();
  if (!bundle) return false;
  assertOutboundEmailAllowed(input.to);
  const raw = encodeRawMessage(
    buildGmailMime({
      from: bundle.email,
      to: input.to,
      subject: input.subject,
      body: input.text,
      htmlBody: input.html,
    })
  );
  const res = await bundle.gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  if (!res.data.id) throw new Error("Gmail send succeeded but returned no message id.");
  return true;
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
