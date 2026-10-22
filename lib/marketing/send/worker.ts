import { waitUntil } from "@vercel/functions";
import { marketingDb } from "../db/client";
import { raiseDb } from "../db/errors";
import { migrateEmailDocument } from "../document/migrate";
import type { MailSender } from "../providers/types";
import { resendSender } from "../providers/resend";
import { siteUrl } from "../../site-url";
import { liveUnsubscribeLink, messageForRecipient } from "./deliver";
import type { PreparedSend } from "./prepare";

const BATCH = 100;
const MAX_ATTEMPTS = 5;

type DeliveryRow = {
  id: string;
  person_id: string;
  to_email: string;
  attempt_count: number;
  provider_message_id: string | null;
  claim_token?: string | null;
};

type SendRow = {
  id: string;
  status: string;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  document_version_id: string | null;
  stats: Record<string, unknown> | null;
};

export type WorkerResult = {
  claimed: number;
  sent: number;
  failed: number;
  remaining: number;
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function isRateLimit(error: string | null | undefined): boolean {
  if (!error) return false;
  return /429|rate limit|too many requests/i.test(error);
}

async function countWhere(sendId: string, statuses: string[]): Promise<number> {
  const db = marketingDb();
  const { count, error } = await db
    .from("email_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("campaign_send_id", sendId)
    .in("status", statuses);
  raiseDb(error);
  return count ?? 0;
}

export async function deliverySnapshot(sendId: string): Promise<{ queued: number; sent: number; failed: number; remaining: number }> {
  const accepted = await countWhere(sendId, ["sent", "delivered", "delayed", "bounced", "complained"]);
  const failed = await countWhere(sendId, ["failed"]);
  const remaining = await countWhere(sendId, ["queued", "sending"]);
  const cancelled = await countWhere(sendId, ["cancelled", "suppressed"]);
  return { queued: accepted + failed + remaining + cancelled, sent: accepted, failed, remaining };
}

export async function resetStaleClaims(): Promise<number> {
  const db = marketingDb();
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: stale, error } = await db
    .from("email_deliveries")
    .update({ status: "queued", claim_token: null, claimed_at: null, updated_at: now })
    .eq("status", "sending")
    .is("provider_message_id", null)
    .lt("claimed_at", cutoff)
    .select("id");
  raiseDb(error);
  const { data: unclaimed, error: unclaimedError } = await db
    .from("email_deliveries")
    .update({ status: "queued", claim_token: null, claimed_at: null, updated_at: now })
    .eq("status", "sending")
    .is("provider_message_id", null)
    .is("claimed_at", null)
    .select("id");
  raiseDb(unclaimedError);
  const { error: sentError } = await db
    .from("email_deliveries")
    .update({ status: "sent", updated_at: now })
    .eq("status", "sending")
    .not("provider_message_id", "is", null);
  raiseDb(sentError);
  return (stale?.length ?? 0) + (unclaimed?.length ?? 0);
}

export async function listSendingIds(): Promise<string[]> {
  const db = marketingDb();
  const { data, error } = await db.from("campaign_sends").select("id").eq("status", "sending").limit(20);
  raiseDb(error);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

async function loadSend(sendId: string): Promise<SendRow | null> {
  const db = marketingDb();
  const { data, error } = await db
    .from("campaign_sends")
    .select("id, status, subject, from_name, from_email, reply_to, document_version_id, stats")
    .eq("id", sendId)
    .maybeSingle();
  raiseDb(error);
  return (data as SendRow | null) ?? null;
}

async function loadPrepared(send: SendRow): Promise<PreparedSend | null> {
  if (!send.document_version_id || !send.from_email?.trim()) return null;
  const db = marketingDb();
  const { data, error } = await db
    .from("email_document_versions")
    .select("id, document_id, document, html, text_plain")
    .eq("id", send.document_version_id)
    .maybeSingle();
  raiseDb(error);
  if (!data) return null;
  const version = data as { id: string; document_id: string; document: unknown; html: string; text_plain: string };
  const document = migrateEmailDocument(version.document);
  return {
    sendId: send.id,
    campaignId: "",
    documentId: version.document_id,
    versionId: version.id,
    document,
    html: version.html,
    text: version.text_plain,
    subject: send.subject || "Crowdsource Choir",
    previewText: "",
    fromName: send.from_name || "Crowdsource Choir",
    fromEmail: send.from_email.trim(),
    replyTo: send.reply_to,
    segmentId: null,
    companyName: "",
    physicalAddress: "",
  };
}

async function claimQueued(sendId: string): Promise<DeliveryRow[]> {
  const db = marketingDb();
  const { data, error } = await db
    .from("email_deliveries")
    .select("id, person_id, to_email, attempt_count, provider_message_id")
    .eq("campaign_send_id", sendId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH);
  raiseDb(error);
  const rows = (data ?? []) as DeliveryRow[];
  const now = new Date().toISOString();
  const token = crypto.randomUUID();
  const claimed: DeliveryRow[] = [];
  for (const group of chunks(rows, 20)) {
    const updated = await Promise.all(
      group.map(async (row) => {
        const nextAttempt = row.attempt_count + 1;
        const { data: saved, error: updateError } = await db
          .from("email_deliveries")
          .update({
            status: "sending",
            claim_token: token,
            claimed_at: now,
            attempt_count: nextAttempt,
            updated_at: now,
          })
          .eq("id", row.id)
          .eq("status", "queued")
          .select("id");
        raiseDb(updateError);
        if (!saved?.length) return null;
        return { ...row, attempt_count: nextAttempt, claim_token: token };
      })
    );
    for (const row of updated) if (row) claimed.push(row);
  }
  return claimed;
}

async function patchDelivery(id: string, claimToken: string | null | undefined, patch: Record<string, unknown>): Promise<void> {
  const db = marketingDb();
  let query = db.from("email_deliveries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (claimToken) query = query.eq("claim_token", claimToken);
  const { error } = await query;
  raiseDb(error);
}

async function peopleById(ids: string[]): Promise<Map<string, { firstName: string | null; displayName: string | null; city: string | null; subscriptionId: string | null }>> {
  const db = marketingDb();
  const { data, error } = await db
    .from("people")
    .select("id, first_name, display_name, city, communication_subscriptions (id, channel, topic)")
    .in("id", ids);
  raiseDb(error);
  const map = new Map<string, { firstName: string | null; displayName: string | null; city: string | null; subscriptionId: string | null }>();
  for (const row of (data ?? []) as Array<{
    id: string;
    first_name: string | null;
    display_name: string | null;
    city: string | null;
    communication_subscriptions: { id: string; channel: string; topic: string }[] | { id: string; channel: string; topic: string } | null;
  }>) {
    const subscriptions = row.communication_subscriptions
      ? Array.isArray(row.communication_subscriptions)
        ? row.communication_subscriptions
        : [row.communication_subscriptions]
      : [];
    const subscription = subscriptions.find((item) => item.channel === "email" && item.topic === "marketing");
    map.set(row.id, {
      firstName: row.first_name,
      displayName: row.display_name,
      city: row.city,
      subscriptionId: subscription?.id ?? null,
    });
  }
  return map;
}

async function finishSend(sendId: string): Promise<WorkerResult> {
  const db = marketingDb();
  const send = await loadSend(sendId);
  const snapshot = await deliverySnapshot(sendId);
  if (!send || send.status === "cancelled") {
    return { claimed: 0, sent: snapshot.sent, failed: snapshot.failed, remaining: snapshot.remaining };
  }
  const skipped = Number(send.stats?.skipped ?? 0);
  let status = send.status;
  let completedAt: string | null = null;
  if (snapshot.remaining === 0 && send.status === "sending") {
    completedAt = new Date().toISOString();
    status = snapshot.sent > 0 && snapshot.failed > 0 ? "partially_failed" : snapshot.sent > 0 ? "sent" : "failed";
  }
  const { error } = await db
    .from("campaign_sends")
    .update({
      status,
      completed_at: completedAt,
      stats: {
        queued: snapshot.queued,
        sent: snapshot.sent,
        failed: snapshot.failed,
        remaining: snapshot.remaining,
        skipped,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sendId);
  raiseDb(error);
  return { claimed: 0, sent: snapshot.sent, failed: snapshot.failed, remaining: snapshot.remaining };
}

const MAX_CHAIN_HOPS = 40;

function scheduleContinuation(sendId: string, hops: number): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || hops > MAX_CHAIN_HOPS) return;
  const job = fetch(
    `${siteUrl()}/api/marketing/cron/send?sendId=${encodeURIComponent(sendId)}&hops=${hops}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    }
  ).then(() => undefined);
  try {
    waitUntil(job);
  } catch {
    void job;
  }
}

async function reclaimSend(sendId: string): Promise<void> {
  const db = marketingDb();
  const now = new Date().toISOString();
  const { error } = await db
    .from("email_deliveries")
    .update({ status: "queued", claim_token: null, claimed_at: null, updated_at: now })
    .eq("campaign_send_id", sendId)
    .eq("status", "sending")
    .is("provider_message_id", null);
  raiseDb(error);
  const { error: sentError } = await db
    .from("email_deliveries")
    .update({ status: "sent", updated_at: now })
    .eq("campaign_send_id", sendId)
    .eq("status", "sending")
    .not("provider_message_id", "is", null);
  raiseDb(sentError);
}

export async function runSendWorker(
  sendId: string,
  options?: { budgetMs?: number; sender?: MailSender; chain?: boolean; hops?: number }
): Promise<WorkerResult> {
  const budgetMs = options?.budgetMs ?? 240_000;
  const sender = options?.sender ?? resendSender();
  const started = Date.now();
  let claimed = 0;
  await reclaimSend(sendId);

  while (Date.now() - started < budgetMs) {
    const send = await loadSend(sendId);
    if (!send || send.status === "cancelled") break;
    if (send.status !== "sending") break;
    const prepared = await loadPrepared(send);
    if (!prepared) break;

    const batch = await claimQueued(sendId);
    if (batch.length === 0) break;
    claimed += batch.length;
    const people = await peopleById(batch.map((row) => row.person_id));
    const outbound: { row: DeliveryRow; priorAttempt: number; message: ReturnType<typeof messageForRecipient> }[] = [];

    for (const row of batch) {
      const priorAttempt = row.attempt_count - 1;
      if (row.provider_message_id) {
        await patchDelivery(row.id, row.claim_token, { status: "sent", sent_at: new Date().toISOString(), last_error: null });
        continue;
      }
      if (row.attempt_count > MAX_ATTEMPTS) {
        await patchDelivery(row.id, row.claim_token, { status: "failed", last_error: "Too many attempts" });
        continue;
      }
      const person = people.get(row.person_id);
      if (!person?.subscriptionId) {
        await patchDelivery(row.id, row.claim_token, { status: "failed", last_error: "Missing subscription" });
        continue;
      }
      const message = messageForRecipient({
        prepared,
        to: row.to_email,
        firstName: person.firstName,
        displayName: person.displayName,
        city: person.city,
        unsubscribe: liveUnsubscribeLink(row.person_id, person.subscriptionId),
        subject: prepared.subject,
        idempotencyKey: `delivery:${row.id}`,
      });
      if (message.html.includes("{{")) {
        await patchDelivery(row.id, row.claim_token, { status: "failed", last_error: "Unresolved personalization token" });
        continue;
      }
      outbound.push({ row, priorAttempt, message });
    }

    const messages = outbound.map((item) => item.message);

    if (messages.length === 0) continue;
    let outcomes;
    try {
      outcomes = await sender.sendBatch(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resend request failed";
      const rateLimited = isRateLimit(message);
      for (const item of outbound) {
        await patchDelivery(item.row.id, item.row.claim_token, rateLimited
          ? { status: "queued", claim_token: null, claimed_at: null, attempt_count: item.priorAttempt, last_error: message }
          : { status: item.row.attempt_count >= MAX_ATTEMPTS ? "failed" : "queued", claim_token: null, claimed_at: null, last_error: message });
      }
      break;
    }

    let rateLimited = false;
    for (let index = 0; index < outbound.length; index += 1) {
      const item = outbound[index];
      const outcome = outcomes[index];
      if (!item) continue;
      if (outcome?.id) {
        await patchDelivery(item.row.id, item.row.claim_token, {
          status: "sent",
          provider_message_id: outcome.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        });
        continue;
      }
      const error = outcome?.error || "Resend rejected the message";
      if (isRateLimit(error)) {
        rateLimited = true;
        await patchDelivery(item.row.id, item.row.claim_token, {
          status: "queued",
          claim_token: null,
          claimed_at: null,
          attempt_count: item.priorAttempt,
          last_error: error,
        });
        continue;
      }
      const giveUp = item.row.attempt_count >= MAX_ATTEMPTS;
      await patchDelivery(item.row.id, item.row.claim_token, {
        status: giveUp ? "failed" : "queued",
        claim_token: null,
        claimed_at: null,
        last_error: error,
      });
    }
    const accepted = outcomes.filter((outcome) => outcome?.id).length;
    if (rateLimited || accepted === 0) break;
  }

  const snapshot = await finishSend(sendId);
  if (options?.chain && snapshot.remaining > 0) scheduleContinuation(sendId, (options.hops ?? 0) + 1);
  return { ...snapshot, claimed };
}
