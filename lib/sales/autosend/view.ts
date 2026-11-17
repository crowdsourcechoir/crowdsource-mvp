import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import {
  AUTO_SEND_DAILY_CAP,
  AUTO_SEND_WEEKLY_CAP,
  addDaysYmd,
  formatPacificDay,
  pacificClock,
  pacificWeekStart,
} from "./policy";
import type { AutoSendSlot, AutoSendState } from "./types";

export type AutoSendQueueGroup = {
  key: string;
  label: string;
  slots: AutoSendSlot[];
};

export type AutoSendQueueView = {
  enabled: boolean;
  gmailConnected: boolean;
  gmailSendsEnabled: boolean;
  today: string;
  inWindow: boolean;
  sentToday: number;
  dailyCap: number;
  weekSent: number;
  weeklyCap: number;
  nextSendAt: string | null;
  groups: AutoSendQueueGroup[];
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
  const gmail = await getGmailConnectionStatus().catch(() => ({ connected: false, sendsEnabled: false }));
  const sentToday = state.slots.filter((slot) => slot.day === today && slot.status === "sent");
  const failedToday = state.slots.filter((slot) => slot.day === today && (slot.status === "failed" || slot.status === "skipped"));
  const queuedToday = state.slots.filter((slot) => slot.day === today && (slot.status === "queued" || slot.status === "sending"));
  const weekSent = state.slots.filter((slot) => slot.status === "sent" && slot.day >= weekStart && slot.day <= today);
  const futureDays = Array.from(
    new Set(state.slots.filter((slot) => slot.day > today && slot.status === "queued").map((slot) => slot.day))
  ).sort();

  const groups: AutoSendQueueGroup[] = [
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

  return {
    enabled: state.enabled,
    gmailConnected: gmail.connected,
    gmailSendsEnabled: gmail.sendsEnabled,
    today,
    inWindow: clock.minutes >= 8 * 60 && clock.minutes < 17 * 60 && clock.weekday !== "Sat" && clock.weekday !== "Sun",
    sentToday: sentToday.length,
    dailyCap: AUTO_SEND_DAILY_CAP,
    weekSent: weekSent.length,
    weeklyCap: AUTO_SEND_WEEKLY_CAP,
    nextSendAt: next?.scheduledAt ?? null,
    groups: groups.filter((group) => group.slots.length > 0 || group.key === "sent" || group.key === "today"),
    storeError: error,
  };
}
