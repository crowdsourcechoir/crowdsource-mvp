import { getOrganization } from "@/lib/sales/db/organizations";
import { listAwaitingContactOrganizationIds } from "@/lib/sales/db/awaitingContact";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { sendSelfEmailViaGmail } from "@/lib/sales/gmail/send";
import {
  AUTO_SEND_DAILY_CAP,
  AUTO_SEND_WEEKLY_CAP,
  formatPacificDay,
  formatPacificWhen,
  isAssociationProspect,
  pacificLocalToIso,
  pacificWeekStart,
} from "./policy";
import type { AutoSendSlot, AutoSendState } from "./types";

async function weekOutcomes(weekStartYmd: string): Promise<{ replies: number; wins: number }> {
  const since = pacificLocalToIso(weekStartYmd, 0);
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("relationship_stage")
    .in("relationship_stage", ["interest", "purchase"])
    .gte("stage_updated_at", since);
  if (error) throw new Error(error.message);
  let replies = 0;
  let wins = 0;
  for (const row of data ?? []) {
    if (row.relationship_stage === "interest") replies += 1;
    if (row.relationship_stage === "purchase") wins += 1;
  }
  return { replies, wins };
}

async function linkedInHolds(): Promise<{ organizationName: string; score: number }[]> {
  const rows = await listAwaitingContactOrganizationIds(12, 70);
  const holds: { organizationName: string; score: number }[] = [];
  for (const row of rows) {
    const org = await getOrganization(row.organizationId);
    if (!org || isAssociationProspect(org.name, null)) continue;
    holds.push({ organizationName: org.name, score: row.score });
    if (holds.length >= 8) break;
  }
  return holds;
}

function lineFor(slot: AutoSendSlot): string {
  const who = slot.contactName ? `${slot.contactName} <${slot.contactEmail}>` : slot.contactEmail;
  return `${slot.organizationName} — ${who} — ${slot.eventTitle} (${slot.eventDate}) — score ${Math.round(slot.score)}`;
}

export function daySendReportDue(state: AutoSendState, todayYmd: string, afterClose: boolean): boolean {
  if (state.reports.some((mark) => mark.day === todayYmd)) return false;
  const todaySlots = state.slots.filter((slot) => slot.day === todayYmd);
  const open = todaySlots.some((slot) => slot.status === "queued" || slot.status === "sending");
  const finished = todaySlots.filter((slot) => slot.status === "sent" || slot.status === "failed" || slot.status === "skipped").length;
  if (!open && finished >= AUTO_SEND_DAILY_CAP) return true;
  return afterClose;
}

export async function sendDayReport(state: AutoSendState, todayYmd: string): Promise<{ sentAt: string; to: string }> {
  const todaySlots = state.slots.filter((slot) => slot.day === todayYmd);
  const sent = todaySlots.filter((slot) => slot.status === "sent");
  const failed = todaySlots.filter((slot) => slot.status === "failed" || slot.status === "skipped");
  const weekStart = pacificWeekStart(todayYmd);
  const weekSent = state.slots.filter((slot) => slot.status === "sent" && slot.day >= weekStart && slot.day <= todayYmd);
  const tomorrow = state.slots
    .filter((slot) => slot.status === "queued" && slot.day > todayYmd)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const nextDay = tomorrow[0]?.day ?? null;
  const nextLine = nextDay ? tomorrow.filter((slot) => slot.day === nextDay) : [];

  let outcomes = { replies: 0, wins: 0 };
  let holds: { organizationName: string; score: number }[] = [];
  try {
    outcomes = await weekOutcomes(weekStart);
  } catch {
    outcomes = { replies: 0, wins: 0 };
  }
  try {
    holds = await linkedInHolds();
  } catch {
    holds = [];
  }

  const subject = `Sales send report · ${formatPacificDay(todayYmd)} · ${sent.length} sent`;
  const text = [
    `${sent.length} of ${AUTO_SEND_DAILY_CAP} outreach emails sent on ${formatPacificDay(todayYmd)}.`,
    "",
    "Sent",
    sent.length ? sent.map((slot) => `- ${formatPacificWhen(slot.sentAt ?? slot.scheduledAt)} · ${lineFor(slot)}`).join("\n") : "- None",
    "",
    "Not sent",
    failed.length ? failed.map((slot) => `- ${slot.organizationName}: ${slot.error ?? slot.status}`).join("\n") : "- None",
    "",
    `This week: ${weekSent.length} of ${AUTO_SEND_WEEKLY_CAP} sends.`,
    `Replies marked on the funnel: ${outcomes.replies}. Wins: ${outcomes.wins} (target 1). Meeting target is 5 — mark those on the funnel when they are booked.`,
    "",
    nextLine.length
      ? `Next business day (${formatPacificDay(nextDay!)}): ${nextLine.length} in line.`
      : "Next business day: nothing lined up yet.",
    nextLine.slice(0, 25).map((slot) => `- ${lineFor(slot)}`).join("\n"),
    "",
    "High scores with no verified contact",
    holds.length ? holds.map((hold) => `- ${hold.organizationName} — score ${Math.round(hold.score)}`).join("\n") : "- None",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const html = text
    .split("\n")
    .map((line) => `<p style="margin:0 0 8px;font-family:sans-serif;font-size:14px;">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "&nbsp;"}</p>`)
    .join("");

  const mailed = await sendSelfEmailViaGmail({ subject, text, html });
  return { sentAt: new Date().toISOString(), to: mailed.to };
}
