import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import {
  AUTO_SEND_DAILY_CAP,
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
  gmailSendsEnabled: boolean;
  gmailComposeGranted: boolean;
  today: string;
  inWindow: boolean;
  sentToday: number;
  draftedToday: number;
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

export async function buildAutoSendQueueView(state: AutoSendState, error: string | null, now: Date = new Date()): Promise<AutoSendQueueView> {
  const clock = pacificClock(now);
  const today = clock.ymd;
  const tomorrow = addDaysYmd(today, 1);
  const weekStart = pacificWeekStart(today);
  const gmail = await getGmailConnectionStatus().catch(() => ({
    connected: false,
    sendsEnabled: false,
    composeGranted: false,
  }));
  const sentToday = state.slots.filter((slot) => slot.day === today && slot.status === "sent");
  const draftedToday = state.slots.filter((slot) => slot.day === today && slot.status === "drafted");
  const failedToday = state.slots.filter((slot) => slot.day === today && (slot.status === "failed" || slot.status === "skipped"));
  const queuedToday = state.slots.filter((slot) => slot.day === today && (slot.status === "queued" || slot.status === "sending"));
  const weekSent = state.slots.filter(
    (slot) => (slot.status === "sent" || slot.status === "drafted") && slot.day >= weekStart && slot.day <= today
  );
  const futureDays = Array.from(
    new Set(state.slots.filter((slot) => slot.day > today && slot.status === "queued").map((slot) => slot.day))
  ).sort();

  const groups: AutoSendQueueGroup[] = [
    { key: "drafts", label: "In Gmail Drafts", slots: sortSlots(draftedToday) },
    { key: "sent", label: "Sent", slots: sortSlots([...sentToday, ...failedToday]) },
    { key: "today", label: "In line today", slots: sortSlots(queuedToday) },
  ];
  for (const day of futureDays) {
    const label = day === tomorrow ? "In line tomorrow" : formatPacificDay(day);
    groups.push({
      key: day,
      label,
      slots: sortSlots(state.slots.filter((slot) => slot.day === day && slot.status === "queued")),
    });
  }

  const next = state.slots
    .filter((slot) => slot.status === "queued" && Date.parse(slot.scheduledAt) >= now.getTime() - 60_000)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  const mix = AUTO_SEND_LANES.map((lane) => ({
    lane,
    label: LANE_LABEL[lane],
    quota: LANE_DAILY_QUOTA[lane],
    sent: sentToday.filter((slot) => slot.lane === lane).length + draftedToday.filter((slot) => slot.lane === lane).length,
    lined: queuedToday.filter((slot) => slot.lane === lane).length,
  }));

  return {
    enabled: state.enabled,
    gmailConnected: gmail.connected,
    gmailSendsEnabled: gmail.sendsEnabled,
    gmailComposeGranted: gmail.composeGranted,
    today,
    inWindow: clock.minutes >= 8 * 60 && clock.minutes < 17 * 60 && clock.weekday !== "Sat" && clock.weekday !== "Sun",
    sentToday: sentToday.length,
    draftedToday: draftedToday.length,
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
