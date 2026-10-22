/**
 * Cash-now queue scope — near-term closes for the 90-day $45–75K contracted-work goal.
 *
 * Matches when any of:
 * - event date estimate is within the next 90 days (inclusive of today)
 * - funnel stage is Interest
 * - a follow-up is due
 */

export const QUEUE_CASH_WINDOWS = ["all", "cash_now"] as const;
export type QueueCashWindow = (typeof QUEUE_CASH_WINDOWS)[number];

export const QUEUE_CASH_WINDOW_OPTIONS: { key: QueueCashWindow; label: string }[] = [
  { key: "all", label: "All timing" },
  { key: "cash_now", label: "Cash now" },
];

/** Days ahead for the cash-now event window. */
export const CASH_NOW_EVENT_DAYS = 90;

export function parseQueueCashWindow(raw: string | null | undefined): QueueCashWindow {
  if (raw === "cash_now" || raw === "now") return "cash_now";
  return "all";
}

/** YYYY-MM-DD for a Date in local calendar (UTC date parts when given a date-only string). */
export function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function eventInCashNowWindow(
  eventDateEstimate: string | null | undefined,
  todayDateOnly: string = toDateOnlyString(new Date()),
  windowDays: number = CASH_NOW_EVENT_DAYS
): boolean {
  if (!eventDateEstimate) return false;
  const event = eventDateEstimate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event)) return false;
  const end = addDaysDateOnly(todayDateOnly, windowDays);
  return event >= todayDateOnly && event <= end;
}

export type CashNowMatchInput = {
  eventDateEstimate?: string | null;
  relationshipStage?: string | null;
  followUpDue?: boolean;
};

export function matchesCashNow(input: CashNowMatchInput, todayDateOnly?: string): boolean {
  if (eventInCashNowWindow(input.eventDateEstimate, todayDateOnly)) return true;
  if (input.relationshipStage === "interest") return true;
  if (input.followUpDue) return true;
  return false;
}

export function matchesQueueCashWindow(
  input: CashNowMatchInput,
  window: QueueCashWindow,
  todayDateOnly?: string
): boolean {
  if (window === "all") return true;
  return matchesCashNow(input, todayDateOnly);
}

export function countCashNow<T extends CashNowMatchInput>(
  items: T[],
  todayDateOnly?: string
): { all: number; cash_now: number } {
  let cashNow = 0;
  for (const item of items) {
    if (matchesCashNow(item, todayDateOnly)) cashNow += 1;
  }
  return { all: items.length, cash_now: cashNow };
}
