import { getGmailConnectionStatus } from "@/lib/sales/db/gmail";
import { decideQueueItem, getQueueItem } from "@/lib/sales/db/queue";
import { getOpportunity, updateOpportunityStatus, updateOpportunityTouchTimestamps } from "@/lib/sales/db/opportunities";
import { getDraft, updateDraftDecision } from "@/lib/sales/db/outreach";
import { listActivitiesForOpportunity } from "@/lib/sales/db/activities";
import { deleteGmailDraft } from "@/lib/sales/gmail/send";
import { listAutoSendCandidates } from "./candidates";
import { mergeAutoSendSlots } from "./plan";
import { pacificClock, WINDOW_END_MINUTE } from "./policy";
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
 * Remove a lead from the lineup ("Don't send" / "Delete"), delete any unsent Gmail draft
 * already filed for it, mark the queue item rejected so it never comes back, and immediately
 * pull the next best $15k+ candidate into the freed seat.
 */
export async function dismissAutoSendSlot(input: {
  queueItemId: string;
  day?: string | null;
}): Promise<{ state: AutoSendState; deletedGmailDraft: boolean; error: string | null }> {
  const { state, error } = await readAutoSendState();
  if (error) return { state, deletedGmailDraft: false, error };

  const matching = state.slots.filter(
    (slot) => slot.queueItemId === input.queueItemId && (!input.day || slot.day === input.day)
  );
  const target = matching[0] ?? null;

  let deletedGmailDraft = false;
  let draftIdToDelete = target?.gmailDraftId ?? null;

  const item = await getQueueItem(input.queueItemId).catch(() => null);
  const opportunityId = target?.opportunityId || item?.opportunityId || null;

  if (!draftIdToDelete && opportunityId) {
    const activities = await listActivitiesForOpportunity(opportunityId).catch(() => []);
    for (let index = activities.length - 1; index >= 0; index -= 1) {
      const act = activities[index];
      if (act.metadata?.kind === "gmail_draft" && typeof act.metadata?.gmailDraftId === "string") {
        draftIdToDelete = act.metadata.gmailDraftId;
        break;
      }
    }
  }

  if (draftIdToDelete) {
    const del = await deleteGmailDraft(draftIdToDelete);
    deletedGmailDraft = del.deleted;
  }

  if (opportunityId) {
    const opp = await getOpportunity(opportunityId).catch(() => null);
    if (opp && !opp.lastOutboundAt && !opp.lastInboundAt) {
      await updateOpportunityTouchTimestamps(opportunityId, { gmailThreadId: null }).catch(() => undefined);
    }
  }

  if (item) {
    if (item.outreachDraftId) {
      const draft = await getDraft(item.outreachDraftId).catch(() => null);
      if (draft && draft.status !== "approved" && draft.status !== "approved_with_edits") {
        await updateDraftDecision(draft.id, { status: "rejected" }).catch(() => undefined);
      }
    }
    await decideQueueItem(item.id, {
      status: "rejected",
      decidedBy: "operator",
      decisionNotes: "Removed from the $15k+ lineup (Don't send).",
    }).catch(() => undefined);
    if (item.kind === "initial") {
      await updateOpportunityStatus(item.opportunityId, "rejected").catch(() => undefined);
    }
  }

  const remainingSlots = state.slots.filter((slot) => slot.queueItemId !== input.queueItemId);
  const clearedState: AutoSendState = { ...state, slots: remainingSlots };
  const writeErr = await persist(clearedState);
  if (writeErr) return { state: clearedState, deletedGmailDraft, error: writeErr };

  const refreshed = await refreshAutoSendPlan();
  return { state: refreshed.state, deletedGmailDraft, error: refreshed.error };
}

/**
 * Line up the next 30 business days of $15k+ leads and pre-load Gmail drafts immediately
 * (any hour of day, up to `maxToDraft` queued slots in chronological order) so the Drafts
 * inbox stays stocked ahead of time instead of waiting on a weekday clock.
 * This queue never sends prospect mail.
 */
export async function tickAutoSend(
  now: Date = new Date(),
  opts?: { maxToDraft?: number; forceWhenPaused?: boolean }
): Promise<AutoSendTick> {
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
  if (!state.enabled && !opts?.forceWhenPaused) {
    return { enabled: state.enabled, sent: 0, drafted: 0, skipped: 0, failed: 0, linedUp, reportSent: false, error: null };
  }

  let drafted = 0;
  let skipped = 0;
  let failed = 0;
  const gmail = await getGmailConnectionStatus();
  const killed = process.env.SALES_GMAIL_SENDS_ENABLED?.trim() === "false";
  let gateError: string | null = null;
  if (killed) {
    gateError = "Gmail is turned off (SALES_GMAIL_SENDS_ENABLED=false). No drafts were created.";
  } else if (gmail.connected && !gmail.composeGranted) {
    gateError = "Reconnect Google and allow Gmail compose so drafts can be filed directly in Gmail Drafts.";
  }

  if (gmail.connected && gmail.composeGranted && !killed) {
    const burst = Math.max(1, Math.min(25, opts?.maxToDraft ?? 8));
    const due = state.slots
      .filter((slot) => slot.status === "queued")
      .sort((a, b) => a.day.localeCompare(b.day) || a.scheduledAt.localeCompare(b.scheduledAt))
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
                body: result.body,
                draftUrl: result.draftUrl,
                gmailDraftId: result.gmailDraftId,
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
          return applySendResult(
            { ...row, status: "queued", attempts, error: result.error },
            nowIso
          );
        }),
      };
      await persist(state);
    }

    if (skipped > 0) {
      const refilled = await refreshAutoSendPlan(now);
      if (!refilled.error) state = refilled.state;
    }
  }

  let reportSent = false;
  const clock = pacificClock(now);
  const businessAfterClose =
    clock.minutes >= WINDOW_END_MINUTE && clock.weekday !== "Sat" && clock.weekday !== "Sun";
  if (state.enabled && daySendReportDue(state, today, businessAfterClose)) {
    try {
      const report = await sendDayReport(state, today);
      state = { ...state, reports: [...state.reports.filter((mark) => mark.day !== today), { day: today, sentAt: report.sentAt }] };
      await persist(state);
      reportSent = true;
    } catch (err) {
      return {
        enabled: state.enabled,
        sent: 0,
        drafted,
        skipped,
        failed,
        linedUp: state.slots.filter((slot) => slot.status === "queued").length,
        reportSent: false,
        error: err instanceof Error ? err.message : "Report failed.",
      };
    }
  }

  return {
    enabled: state.enabled,
    sent: 0,
    drafted,
    skipped,
    failed,
    linedUp: state.slots.filter((slot) => slot.status === "queued").length,
    reportSent,
    error: gateError,
  };
}
