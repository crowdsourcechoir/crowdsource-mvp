import { Resend } from "resend";
import { marketingDb } from "../db/client";
import { raiseDb } from "../db/errors";
import { suppressComplaint, suppressHardBounce } from "./effects";
import { forwardStatus, mapResendWebhook } from "./webhook";

type DeliveryRow = {
  id: string;
  campaign_send_id: string;
  person_id: string;
  status: string;
  recorded_open_count: number;
  first_recorded_open_at: string | null;
  click_count: number;
  first_click_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
};

export async function receiveResendWebhook(
  raw: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return { status: 503, body: { error: "RESEND_WEBHOOK_SECRET is not configured." } };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { status: 400, body: { error: "Missing webhook signature." } };
  }

  let event: { type: string; created_at: string; data: Record<string, unknown> };
  try {
    const verified = new Resend(process.env.RESEND_API_KEY || "re_webhook_verify").webhooks.verify({
      payload: raw,
      headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature },
      webhookSecret: secret,
    });
    const data = verified.data && typeof verified.data === "object" ? (verified.data as unknown as Record<string, unknown>) : {};
    event = { type: verified.type, created_at: verified.created_at, data };
  } catch {
    return { status: 400, body: { error: "Invalid webhook signature." } };
  }

  const mapped = mapResendWebhook(event.type, event.data);
  const providerMessageId = typeof event.data.email_id === "string" ? event.data.email_id : null;
  const click = event.data.click;
  const clickUrl =
    click && typeof click === "object" && typeof (click as { link?: unknown }).link === "string"
      ? (click as { link: string }).link
      : null;

  const db = marketingDb();
  let delivery: DeliveryRow | null = null;
  if (providerMessageId) {
    const { data, error } = await db
      .from("email_deliveries")
      .select("id, campaign_send_id, person_id, status, recorded_open_count, first_recorded_open_at, click_count, first_click_at, sent_at, delivered_at")
      .eq("provider", "resend")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    raiseDb(error);
    delivery = (data as DeliveryRow | null) ?? null;
  }

  let linkId: string | null = null;
  if (delivery && clickUrl) {
    const { data: send, error: sendError } = await db
      .from("campaign_sends")
      .select("document_version_id")
      .eq("id", delivery.campaign_send_id)
      .maybeSingle();
    raiseDb(sendError);
    const versionId = (send as { document_version_id: string | null } | null)?.document_version_id;
    if (versionId) {
      const { data: link, error: linkError } = await db
        .from("email_links")
        .select("id")
        .eq("document_version_id", versionId)
        .eq("href", clickUrl)
        .limit(1)
        .maybeSingle();
      raiseDb(linkError);
      linkId = (link as { id: string } | null)?.id ?? null;
    }
  }

  const { error: insertError } = await db.from("email_events").insert({
    delivery_id: delivery?.id ?? null,
    campaign_send_id: delivery?.campaign_send_id ?? null,
    provider: "resend",
    provider_event_id: headers.id,
    provider_message_id: providerMessageId,
    event_type: mapped.eventType,
    occurred_at: event.created_at || new Date().toISOString(),
    link_id: linkId,
    url: clickUrl,
    payload: event,
  });
  if (insertError?.code === "23505") return { status: 200, body: { ok: true, duplicate: true } };
  raiseDb(insertError);
  if (!delivery) return { status: 200, body: { ok: true, linked: false } };

  const occurred = event.created_at || new Date().toISOString();
  const patch: Record<string, unknown> = {};
  const next = forwardStatus(delivery.status, mapped.nextStatus);
  if (next) {
    patch.status = next;
    if (next === "sent" && !delivery.sent_at) patch.sent_at = occurred;
    if (next === "delivered") patch.delivered_at = delivery.delivered_at ?? occurred;
  }
  if (mapped.eventType === "opened") {
    patch.recorded_open_count = (delivery.recorded_open_count ?? 0) + 1;
    patch.first_recorded_open_at = delivery.first_recorded_open_at ?? occurred;
    patch.last_recorded_open_at = occurred;
  }
  if (mapped.eventType === "clicked") {
    patch.click_count = (delivery.click_count ?? 0) + 1;
    patch.first_click_at = delivery.first_click_at ?? occurred;
    patch.last_click_at = occurred;
  }
  if (Object.keys(patch).length) {
    const { error } = await db.from("email_deliveries").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", delivery.id);
    raiseDb(error);
  }
  if (mapped.suppress === "complaint") await suppressComplaint(delivery.person_id);
  if (mapped.suppress === "hard_bounce") await suppressHardBounce(delivery.person_id);
  return { status: 200, body: { ok: true, linked: true } };
}
