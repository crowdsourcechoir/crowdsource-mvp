import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { coalesceDraftBody, coalesceDraftSubject } from "@/lib/sales/outreach/email-body-format";
import { readAnthemPricing } from "@/lib/sales/pricing/metadata";
import { readDealForecast } from "@/lib/sales/engines";
import {
  AUTO_SEND_DAILY_CAP,
  AUTO_SEND_HORIZON_DAYS,
  AUTO_SEND_LANES,
  AUTO_SEND_WEEKLY_CAP,
  LANE_DAILY_QUOTA,
  LANE_LABEL,
  addDaysYmd,
  formatPacificDay,
  pacificClock,
  pacificWeekStart,
  type AutoSendLane,
} from "./policy";
import type { AutoSendLaneCounts, AutoSendSlot, AutoSendState } from "./types";

export type AutoSendQueueGroup = {
  key: string;
  label: string;
  slots: AutoSendSlot[];
};

export type AutoSendQueueView = {
  enabled: boolean;
  gmailConnected: boolean;
  gmailEmail: string | null;
  gmailSendsEnabled: boolean;
  gmailComposeGranted: boolean;
  today: string;
  horizonDays: number;
  inWindow: boolean;
  sentToday: number;
  draftedToday: number;
  totalDrafted: number;
  totalLinedUp: number;
  daysCovered: number;
  dailyCap: number;
  weekSent: number;
  weeklyCap: number;
  nextSendAt: string | null;
  groups: AutoSendQueueGroup[];
  ready: AutoSendLaneCounts | null;
  mix: { lane: AutoSendLane; label: string; quota: number; sent: number; lined: number }[];
  storeError: string | null;
};

function sortSlots(slots: AutoSendSlot[]): AutoSendSlot[] {
  return [...slots].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.organizationName.localeCompare(b.organizationName));
}

async function hydrateMissingSlotBodies(slots: AutoSendSlot[]): Promise<AutoSendSlot[]> {
  const needs = slots.filter((slot) => !slot.body || slot.suggestedFee === undefined);
  if (needs.length === 0) return slots;
  try {
    const db = requireSupabaseAdmin();
    const queueIds = Array.from(new Set(needs.map((slot) => slot.queueItemId).filter(Boolean))).slice(0, 500);
    const { data: qRows } = await db
      .from("approval_queue_items")
      .select("id, opportunity_id, outreach_draft_id")
      .in("id", queueIds);
    const draftIdByQueue = new Map<string, string>();
    const oppIds = new Set<string>();
    for (const row of (qRows ?? []) as { id: string; opportunity_id: string; outreach_draft_id: string | null }[]) {
      if (row.outreach_draft_id) draftIdByQueue.set(row.id, row.outreach_draft_id);
      if (row.opportunity_id) oppIds.add(row.opportunity_id);
    }

    const draftIds = Array.from(new Set(draftIdByQueue.values()));
    const draftBodyById = new Map<string, { subject: string; body: string }>();
    for (let i = 0; i < draftIds.length; i += 150) {
      const chunk = draftIds.slice(i, i + 150);
      const { data: dRows } = await db
        .from("outreach_drafts")
        .select("id, ai_subject, edited_subject, ai_body, edited_body")
        .in("id", chunk);
      for (const d of (dRows ?? []) as {
        id: string;
        ai_subject: string | null;
        edited_subject: string | null;
        ai_body: string | null;
        edited_body: string | null;
      }[]) {
        draftBodyById.set(d.id, {
          subject: coalesceDraftSubject(d.edited_subject, d.ai_subject),
          body: coalesceDraftBody(d.edited_body, d.ai_body),
        });
      }
    }

    const oppIdList = Array.from(oppIds);
    const feeByOpp = new Map<string, number | null>();
    for (let i = 0; i < oppIdList.length; i += 150) {
      const chunk = oppIdList.slice(i, i + 150);
      const { data: oRows } = await db
        .from("opportunities")
        .select("id, import_metadata")
        .in("id", chunk);
      for (const o of (oRows ?? []) as { id: string; import_metadata: Record<string, unknown> | null }[]) {
        const fee =
          readAnthemPricing(o.import_metadata).suggestedAnthemFee ??
          readDealForecast(o.import_metadata).potentialAmount ??
          null;
        feeByOpp.set(o.id, fee);
      }
    }

    return slots.map((slot) => {
      const draftId = draftIdByQueue.get(slot.queueItemId);
      const copy = draftId ? draftBodyById.get(draftId) : undefined;
      return {
        ...slot,
        subject: slot.subject || copy?.subject || "",
        body: slot.body ?? copy?.body ?? null,
        suggestedFee: slot.suggestedFee ?? feeByOpp.get(slot.opportunityId) ?? null,
      };
    });
  } catch {
    return slots;
  }
}

export async function buildAutoSendQueueView(state: AutoSendState, error: string | null, now: Date = new Date()): Promise<AutoSendQueueView> {
  const clock = pacificClock(now);
  const today = clock.ymd;
  const tomorrow = addDaysYmd(today, 1);
  const weekStart = pacificWeekStart(today);
  const gmail = await getGmailConnectionStatus().catch(() => ({
    connected: false,
    email: null,
    sendsEnabled: false,
    composeGranted: false,
  }));

  const slots = await hydrateMissingSlotBodies(state.slots);

  const sentToday = slots.filter((slot) => slot.day === today && slot.status === "sent");
  const draftedToday = slots.filter((slot) => slot.day === today && slot.status === "drafted");
  const allDrafted = slots.filter((slot) => slot.status === "drafted");
  const allQueued = slots.filter((slot) => slot.status === "queued" || slot.status === "sending");
  const failedToday = slots.filter((slot) => slot.day === today && (slot.status === "failed" || slot.status === "skipped"));
  const queuedToday = slots.filter((slot) => slot.day === today && (slot.status === "queued" || slot.status === "sending"));
  const weekSent = slots.filter(
    (slot) => (slot.status === "sent" || slot.status === "drafted") && slot.day >= weekStart && slot.day <= today
  );
  const futureDays = Array.from(
    new Set(
      slots
        .filter((slot) => slot.day > today && (slot.status === "queued" || slot.status === "sending" || slot.status === "drafted"))
        .map((slot) => slot.day)
    )
  ).sort();

  const coveredDays = new Set(
    slots
      .filter((slot) => slot.day >= today && (slot.status === "queued" || slot.status === "sending" || slot.status === "drafted" || slot.status === "sent"))
      .map((slot) => slot.day)
  );

  const groups: AutoSendQueueGroup[] = [
    { key: "drafts", label: "In Gmail Drafts (ready to review & send)", slots: sortSlots(allDrafted) },
    { key: "sent", label: "Sent earlier", slots: sortSlots([...sentToday, ...failedToday]) },
    { key: "today", label: "In line today", slots: sortSlots(queuedToday) },
  ];
  for (const day of futureDays) {
    const daySlots = sortSlots(
      slots.filter((slot) => slot.day === day && (slot.status === "queued" || slot.status === "sending" || slot.status === "drafted"))
    );
    if (daySlots.length === 0) continue;
    const label = day === tomorrow ? `Tomorrow · ${formatPacificDay(day)}` : formatPacificDay(day);
    groups.push({
      key: day,
      label,
      slots: daySlots,
    });
  }

  const next = slots
    .filter((slot) => slot.status === "queued")
    .sort((a, b) => a.day.localeCompare(b.day) || a.scheduledAt.localeCompare(b.scheduledAt))[0];

  const activeMixLanes = AUTO_SEND_LANES.filter((lane) => LANE_DAILY_QUOTA[lane] > 0);
  const mix = activeMixLanes.map((lane) => ({
    lane,
    label: LANE_LABEL[lane],
    quota: LANE_DAILY_QUOTA[lane],
    sent: sentToday.filter((slot) => slot.lane === lane).length + draftedToday.filter((slot) => slot.lane === lane).length,
    lined: queuedToday.filter((slot) => slot.lane === lane).length,
  }));

  return {
    enabled: state.enabled,
    gmailConnected: gmail.connected,
    gmailEmail: gmail.email ?? null,
    gmailSendsEnabled: gmail.sendsEnabled,
    gmailComposeGranted: gmail.composeGranted,
    today,
    horizonDays: AUTO_SEND_HORIZON_DAYS,
    inWindow: clock.minutes >= 8 * 60 && clock.minutes < 17 * 60 && clock.weekday !== "Sat" && clock.weekday !== "Sun",
    sentToday: sentToday.length,
    draftedToday: draftedToday.length,
    totalDrafted: allDrafted.length,
    totalLinedUp: allQueued.length,
    daysCovered: coveredDays.size,
    dailyCap: AUTO_SEND_DAILY_CAP,
    weekSent: weekSent.length,
    weeklyCap: AUTO_SEND_WEEKLY_CAP,
    nextSendAt: next?.scheduledAt ?? null,
    groups: groups.filter((group) => group.slots.length > 0 || group.key === "drafts" || group.key === "today"),
    ready: state.ready,
    mix,
    storeError: error,
  };
}
