import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { listAutoSendCandidates } from "./candidates";
import { mergeAutoSendSlots } from "./plan";
import { isInsideSendWindow, pacificClock, WINDOW_END_MINUTE } from "./policy";
import { daySendReportDue, sendDayReport } from "./report";
import { sendAutoSendSlot } from "./send-slot";
import { readAutoSendState, writeAutoSendState } from "./store";
import type { AutoSendLaneCounts, AutoSendSlot, AutoSendState } from "./types";

const MAX_ATTEMPTS = 3;

export type AutoSendTick = {
  enabled: boolean;
  sent: number;
  drafted: number;
  skipped: number;
  failed: number;
  linedUp: number;
  reportSent: boolean;
  error: string | null;
};

function applySendResult(slot: AutoSendSlot, nowIso: string): AutoSendSlot {
  return { ...slot, statusSince: nowIso };
}

async function persist(state: AutoSendState): Promise<string | null> {
  const written = await writeAutoSendState(state);
  return written.error;
}

export async function refreshAutoSendPlan(now: Date = new Date()): Promise<{ state: AutoSendState; error: string | null }> {
  const { state, error } = await readAutoSendState();
  if (error) return { state, error };
  let candidates: Awaited<ReturnType<typeof listAutoSendCandidates>> = [];
  try {
    candidates = await listAutoSendCandidates(now);
  } catch (err) {
    return { state, error: err instanceof Error ? err.message : "Could not load candidates." };
  }
  const slots = mergeAutoSendSlots(state.slots, candidates, now);
  const ready: AutoSendLaneCounts = { large: 0, sponsorship: 0, partnership: 0, other: 0 };
  for (const candidate of candidates) ready[candidate.lane] += 1;
  const next: AutoSendState = { ...state, slots, ready, updatedAt: now.toISOString() };
  const writeError = await persist(next);
  return { state: writeError ? state : next, error: writeError };
}

export async function setAutoSendEnabled(enabled: boolean): Promise<{ state: AutoSendState; error: string | null }> {
  const { state, error } = await readAutoSendState();
  if (error) return { state, error };
  const next = { ...state, enabled };
  const writeError = await persist(next);
  if (writeError) return { state, error: writeError };
  return refreshAutoSendPlan();
}

/**
 * Line up the next business days, file Gmail drafts for anything due inside
 * 8:00am–5:00pm Pacific, then mail one report to the connected account once
 * that day's line is finished. Never sends prospect mail.
 */
export async function tickAutoSend(now: Date = new Date()): Promise<AutoSendTick> {
  const refreshed = await refreshAutoSendPlan(now);
  if (refreshed.error) {
    return {
      enabled: refreshed.state.enabled,
      sent: 0,
      drafted: 0,
      skipped: 0,
      failed: 0,
      linedUp: 0,
      reportSent: false,
      error: refreshed.error,
    };
  }
  let state = refreshed.state;
  const today = pacificClock(now).ymd;
  const linedUp = state.slots.filter((slot) => slot.status === "queued").length;
  if (!state.enabled) {
    return { enabled: false, sent: 0, drafted: 0, skipped: 0, failed: 0, linedUp, reportSent: false, error: null };
  }

  let drafted = 0;
  let skipped = 0;
  let failed = 0;
  const gmail = await getGmailConnectionStatus();
  const inWindow = isInsideSendWindow(now);
  const killed = process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "false";
  let gateError: string | null = null;
  if (inWindow && killed) {
    gateError = "Gmail is turned off (SALES_GMAIL_SENDS_ENABLED=false). No drafts were created.";
  } else if (inWindow && gmail.connected && !gmail.composeGranted) {
    gateError = "Reconnect Google and allow Gmail compose. Weekday outreach creates drafts and does not send.";
  }

  if (inWindow && gmail.connected && gmail.composeGranted && !killed) {
    const clock = pacificClock(now);
    const burst = WINDOW_END_MINUTE - clock.minutes <= 60 ? 4 : 2;
    const due = state.slots
      .filter((slot) => slot.status === "queued" && slot.day === today && Date.parse(slot.scheduledAt) <= now.getTime() + 30_000)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, burst);

    for (const slot of due) {
      const nowIso = new Date().toISOString();
      state = {
        ...state,
        slots: state.slots.map((row) =>
          row.queueItemId === slot.queueItemId && row.day === slot.day
            ? { ...row, status: "sending", statusSince: nowIso }
            : row
        ),
      };
      await persist(state);
      const result = await sendAutoSendSlot(slot);
      state = {
        ...state,
        slots: state.slots.map((row) => {
          if (row.queueItemId !== slot.queueItemId || row.day !== slot.day) return row;
          if (result.result === "drafted") {
            drafted += 1;
            return applySendResult(
              {
                ...row,
                status: "drafted",
                sentAt: result.draftedAt,
                subject: result.subject,
                draftUrl: result.draftUrl,
                error: null,
              },
              result.draftedAt
            );
          }
          if (result.result === "skipped") {
            skipped += 1;
            return applySendResult({ ...row, status: "skipped", error: result.error }, nowIso);
          }
          const attempts = row.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            failed += 1;
            return applySendResult({ ...row, status: "failed", attempts, error: result.error }, nowIso);
          }
          return applySendResult({ ...row, status: "queued", attempts, error: result.error }, nowIso);
        }),
      };
      await persist(state);
    }
  }

  let reportSent = false;
  const clock = pacificClock(now);
  const businessAfterClose =
    clock.minutes >= WINDOW_END_MINUTE && clock.weekday !== "Sat" && clock.weekday !== "Sun";
  if (daySendReportDue(state, today, businessAfterClose)) {
    try {
      const report = await sendDayReport(state, today);
      state = {
        ...state,
        reports: [...state.reports.filter((mark) => mark.day !== today), { day: today, sentAt: report.sentAt }],
      };
      await persist(state);
      reportSent = true;
    } catch (err) {
      return {
        enabled: true,
        sent: 0,
        drafted,
        skipped,
        failed,
        linedUp,
        reportSent: false,
        error: err instanceof Error ? err.message : "Report failed.",
      };
    }
  }

  return { enabled: true, sent: 0, drafted, skipped, failed, linedUp, reportSent, error: gateError };
}
