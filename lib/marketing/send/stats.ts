import { marketingDb } from "../db/client";
import { raiseDb } from "../db/errors";
import { engagementStats, type DeliveryEngagementRow } from "./engagement";

type DeliveryStatRow = DeliveryEngagementRow & { campaign_send_id: string };

const PAGE = 1000;

async function loadDeliveries(sendIds: string[]): Promise<DeliveryStatRow[]> {
  const db = marketingDb();
  const rows: DeliveryStatRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("email_deliveries")
      .select("campaign_send_id, status, recorded_open_count, click_count")
      .in("campaign_send_id", sendIds)
      .range(from, from + PAGE - 1);
    raiseDb(error);
    const page = (data ?? []) as { campaign_send_id: string; status: string; recorded_open_count: number; click_count: number }[];
    for (const row of page) {
      rows.push({
        campaign_send_id: row.campaign_send_id,
        status: row.status,
        recordedOpenCount: row.recorded_open_count ?? 0,
        clickCount: row.click_count ?? 0,
      });
    }
    if (page.length < PAGE) break;
  }
  return rows;
}

async function loadUnsubscribeEvents(sendIds: string[]): Promise<Map<string, number>> {
  const db = marketingDb();
  const counts = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("email_events")
      .select("campaign_send_id")
      .in("campaign_send_id", sendIds)
      .eq("event_type", "unsubscribed")
      .range(from, from + PAGE - 1);
    raiseDb(error);
    const page = (data ?? []) as { campaign_send_id: string | null }[];
    for (const row of page) {
      if (!row.campaign_send_id) continue;
      counts.set(row.campaign_send_id, (counts.get(row.campaign_send_id) ?? 0) + 1);
    }
    if (page.length < PAGE) break;
  }
  return counts;
}

/** Merge recorded opens, clicks, bounces, and unsubscribes onto the send without wiping queue counts. */
export async function refreshSendStatsFor(sendIds: string[]): Promise<void> {
  const ids = Array.from(new Set(sendIds.filter(Boolean)));
  if (!ids.length) return;
  const db = marketingDb();
  for (let index = 0; index < ids.length; index += 50) {
    const slice = ids.slice(index, index + 50);
    const [deliveries, unsubscribes, sendResult] = await Promise.all([
      loadDeliveries(slice),
      loadUnsubscribeEvents(slice),
      db.from("campaign_sends").select("id, stats").in("id", slice),
    ]);
    raiseDb(sendResult.error);
    const bySend = new Map<string, DeliveryEngagementRow[]>();
    for (const id of slice) bySend.set(id, []);
    for (const row of deliveries) bySend.get(row.campaign_send_id)?.push(row);
    const now = new Date().toISOString();
    for (const send of (sendResult.data ?? []) as { id: string; stats: Record<string, unknown> | null }[]) {
      const engagement = engagementStats(bySend.get(send.id) ?? [], unsubscribes.get(send.id) ?? 0);
      const { error } = await db
        .from("campaign_sends")
        .update({
          stats: { ...(send.stats ?? {}), ...engagement },
          updated_at: now,
        })
        .eq("id", send.id);
      raiseDb(error);
    }
  }
}

export async function refreshSendStats(sendId: string): Promise<void> {
  await refreshSendStatsFor([sendId]);
}
