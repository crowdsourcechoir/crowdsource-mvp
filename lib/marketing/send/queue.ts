import { marketingDb } from "../db/client";
import { MarketingDbError, raiseDb } from "../db/errors";
import { getMarketingSettings } from "../db/settings";
import { resendConfigured } from "../providers/resend";
import { loadAudience } from "./audience-load";
import { auditSendableHtml, checkListSend } from "./checks";
import { prepareSendVersion } from "./prepare";
import { deliverySnapshot, runSendWorker, type WorkerResult } from "./worker";

const TERMINAL = new Set(["sent", "partially_failed", "failed", "cancelled"]);

export type QueueResult =
  | { ok: true; sendId: string; queued: number; skipped: number }
  | { ok: false; error: string; status: number };

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function failure(err: unknown): QueueResult {
  if (err instanceof MarketingDbError) {
    const error = err.message.includes("Nothing was mailed") ? err.message : `${err.message} Nothing was mailed.`;
    return { ok: false, error, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Could not queue the send.";
  return { ok: false, error: message.includes("Nothing was mailed") ? message : `${message} Nothing was mailed.`, status: 500 };
}

export async function queueListSend(sendId: string, options?: { confirmPhrase?: string; alreadyConfirmed?: boolean }): Promise<QueueResult> {
  const db = marketingDb();
  const { data: existing, error: existingError } = await db
    .from("campaign_sends")
    .select("id, status, segment_id, from_email, stats, document_version_id")
    .eq("id", sendId)
    .maybeSingle();
  raiseDb(existingError);
  if (!existing) return { ok: false, error: "Not found", status: 404 };
  const send = existing as {
    id: string;
    status: string;
    segment_id: string | null;
    from_email: string | null;
    stats: { skipped?: number; queued?: number } | null;
    document_version_id: string | null;
  };
  if (TERMINAL.has(send.status)) {
    return { ok: false, error: "This send already finished. Nothing was mailed.", status: 409 };
  }
  if (send.status === "sending") {
    const snapshot = await deliverySnapshot(sendId);
    if (snapshot.queued > 0) {
      return { ok: true, sendId, queued: snapshot.queued, skipped: Number(send.stats?.skipped ?? 0) };
    }
  }

  const settings = await getMarketingSettings();
  const early = checkListSend({
    confirmPhrase: options?.alreadyConfirmed ? "SEND" : options?.confirmPhrase ?? "",
    sendsEnabled: settings.sendsEnabled,
    fromEmail: (send.from_email || settings.fromEmail).trim(),
    physicalAddress: settings.physicalAddress,
    companyName: settings.companyName,
    segmentId: send.segment_id,
    resendConfigured: resendConfigured(),
    unsubscribeSecret: process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim() ?? "",
  });
  if (!early.ok) return { ok: false, error: early.error, status: 409 };

  let prepared;
  try {
    prepared = await prepareSendVersion(sendId);
  } catch (err) {
    return failure(err);
  }
  const ready = checkListSend({
    confirmPhrase: options?.alreadyConfirmed ? "SEND" : options?.confirmPhrase ?? "",
    sendsEnabled: settings.sendsEnabled,
    fromEmail: prepared.fromEmail,
    physicalAddress: prepared.physicalAddress,
    companyName: prepared.companyName,
    segmentId: prepared.segmentId,
    resendConfigured: resendConfigured(),
    unsubscribeSecret: process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim() ?? "",
  });
  if (!ready.ok) return { ok: false, error: ready.error, status: 409 };
  const htmlProblem = auditSendableHtml(prepared.html);
  if (htmlProblem) return { ok: false, error: htmlProblem, status: 422 };

  const audience = await loadAudience(prepared.segmentId as string);
  if (audience.sendable.length === 0) {
    return { ok: false, error: "Nobody in that segment can be mailed. Nothing was mailed.", status: 409 };
  }

  const now = new Date().toISOString();
  const skipped = audience.matched.length - audience.sendable.length;
  const { error: updateError } = await db
    .from("campaign_sends")
    .update({
      status: "sending",
      from_name: prepared.fromName,
      from_email: prepared.fromEmail,
      reply_to: prepared.replyTo,
      document_version_id: prepared.versionId,
      audience_definition: audience.definition,
      started_at: now,
      completed_at: null,
      stats: { queued: audience.sendable.length, sent: 0, failed: 0, remaining: audience.sendable.length, skipped },
      updated_at: now,
    })
    .eq("id", sendId);
  raiseDb(updateError);

  for (const group of chunks(audience.sendable, 200)) {
    const { error } = await db.from("email_deliveries").upsert(
      group.map((person) => ({
        campaign_send_id: sendId,
        person_id: person.personId,
        to_email: person.email,
        status: "queued",
        provider: "resend",
      })),
      { onConflict: "campaign_send_id,person_id", ignoreDuplicates: true }
    );
    raiseDb(error);
  }

  return { ok: true, sendId, queued: audience.sendable.length, skipped };
}

export async function startListSend(input: {
  sendId: string;
  confirmPhrase?: string;
  alreadyConfirmed?: boolean;
  budgetMs?: number;
}): Promise<
  | { ok: true; queued: number; sent: number; failed: number; skipped: number; remaining: number }
  | { ok: false; error: string; status: number }
> {
  const queued = await queueListSend(input.sendId, {
    confirmPhrase: input.confirmPhrase,
    alreadyConfirmed: input.alreadyConfirmed,
  });
  if (!queued.ok) return queued;
  const worker: WorkerResult = await runSendWorker(input.sendId, { budgetMs: input.budgetMs ?? 20_000, chain: true });
  return {
    ok: true,
    queued: queued.queued,
    sent: worker.sent,
    failed: worker.failed,
    skipped: queued.skipped,
    remaining: worker.remaining,
  };
}

export async function promoteDueSends(): Promise<{ started: string[]; skipped: { id: string; error: string }[] }> {
  const db = marketingDb();
  const { data, error } = await db
    .from("campaign_sends")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(20);
  raiseDb(error);
  const started: string[] = [];
  const skipped: { id: string; error: string }[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    const result = await queueListSend(row.id, { alreadyConfirmed: true });
    if (result.ok) started.push(row.id);
    else skipped.push({ id: row.id, error: result.error });
  }
  return { started, skipped };
}

export async function cancelSend(sendId: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const db = marketingDb();
  const { data, error } = await db.from("campaign_sends").select("id, status").eq("id", sendId).maybeSingle();
  raiseDb(error);
  if (!data) return { ok: false, error: "Not found", status: 404 };
  const status = (data as { status: string }).status;
  if (status === "sent" || status === "partially_failed") {
    return { ok: false, error: "This send already went out.", status: 409 };
  }
  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("campaign_sends")
    .update({ status: "cancelled", completed_at: now, updated_at: now })
    .eq("id", sendId);
  raiseDb(updateError);
  const { error: deliveryError } = await db
    .from("email_deliveries")
    .update({ status: "cancelled", updated_at: now })
    .eq("campaign_send_id", sendId)
    .in("status", ["queued", "sending"])
    .is("provider_message_id", null);
  raiseDb(deliveryError);
  return { ok: true };
}
