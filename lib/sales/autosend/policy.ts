/**
 * Weekday send window and who is allowed into the automated 25/day queue.
 * Research can run any time. Outreach leaves only during this window.
 */

export const PACIFIC = "America/Los_Angeles";
export const AUTO_SEND_DAILY_CAP = 25;
export const AUTO_SEND_WEEKLY_CAP = 175;
export const AUTO_SEND_MIN_SCORE = 70;
export const AUTO_SEND_MIN_AUDIENCE = 6;
export const AUTO_SEND_MIN_BUDGET = 6;
export const SEND_START_MINUTE = 8 * 60;
export const SEND_LAST_MINUTE = 16 * 60 + 30;
export const WINDOW_END_MINUTE = 17 * 60;

const ASSOCIATION_NAME =
  /\b(association|society|council|chapter|federation|coalition)\b/i;

export type EventDateBand = "q1q2_2027" | "q3_2027" | "rolling" | "excluded";

export type PacificClock = {
  ymd: string;
  hour: number;
  minute: number;
  /** Minutes since midnight in America/Los_Angeles. */
  minutes: number;
  weekday: string;
};

export type AutoSendGateInput = {
  organizationName: string;
  organizationTypeKey: string | null;
  doNotProspect: boolean;
  existingClient: boolean;
  alreadyContacted: boolean;
  duplicateWarning: boolean;
  eventDate: string | null;
  totalScore: number | null;
  audienceScore: number | null;
  budgetScore: number | null;
  email: string | null;
  emailVerificationStatus: string | null;
  personName: boolean;
  draftOpen: boolean;
  blockedEmail: boolean;
  queueKind: string;
  queueStatus: string;
};

export function pacificClock(date: Date): PacificClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(read("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(read("minute"));
  return {
    ymd: `${read("year")}-${read("month")}-${read("day")}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
    weekday: read("weekday"),
  };
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = Math.min(day, last);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), clamped)).toISOString().slice(0, 10);
}

const WEEKDAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayOfYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return WEEKDAY_INDEX[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "Sun";
}

export function isBusinessDayYmd(ymd: string): boolean {
  const weekday = weekdayOfYmd(ymd);
  return weekday !== "Sat" && weekday !== "Sun";
}

export function isInsideSendWindow(date: Date): boolean {
  const clock = pacificClock(date);
  return isBusinessDayYmd(clock.ymd) && clock.minutes >= SEND_START_MINUTE && clock.minutes < WINDOW_END_MINUTE;
}

/** Today stays on the board until 5:00pm Pacific. After that the next business day is the first open day. */
export function upcomingBusinessDays(now: Date, count: number): string[] {
  const clock = pacificClock(now);
  const includeToday = isBusinessDayYmd(clock.ymd) && clock.minutes < WINDOW_END_MINUTE;
  const out: string[] = [];
  let cursor = includeToday ? clock.ymd : addDaysYmd(clock.ymd, 1);
  while (out.length < count) {
    if (isBusinessDayYmd(cursor)) out.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

export function pacificWeekStart(ymd: string): string {
  const weekday = weekdayOfYmd(ymd);
  const delta = WEEKDAY_INDEX.indexOf(weekday);
  const fromMonday = delta === 0 ? 6 : delta - 1;
  return addDaysYmd(ymd, -fromMonday);
}

function ymdToDayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Convert a Pacific wall-clock minute-of-day on `ymd` to a UTC ISO timestamp. */
export function pacificLocalToIso(ymd: string, minuteOfDay: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  let utc = Date.UTC(year, month - 1, day, hour + 8, minute, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const clock = pacificClock(new Date(utc));
    const deltaMin = (ymdToDayNumber(ymd) - ymdToDayNumber(clock.ymd)) * 24 * 60 + (minuteOfDay - clock.minutes);
    if (deltaMin === 0) break;
    utc += deltaMin * 60 * 1000;
  }
  return new Date(utc).toISOString();
}

/** 25 send times from 8:00am through 4:30pm Pacific. */
export function slotGridIso(day: string): string[] {
  const span = SEND_LAST_MINUTE - SEND_START_MINUTE;
  return Array.from({ length: AUTO_SEND_DAILY_CAP }, (_, index) => {
    const minute = Math.round(SEND_START_MINUTE + (span * index) / (AUTO_SEND_DAILY_CAP - 1));
    return pacificLocalToIso(day, minute);
  });
}

const SLOT_GRACE_MS = 25 * 60 * 1000;

export function openSlotTimes(day: string, now: Date, taken: string[], count: number): string[] {
  if (count <= 0) return [];
  const takenSet = new Set(taken);
  const grid = slotGridIso(day).filter(
    (iso) => !takenSet.has(iso) && Date.parse(iso) >= now.getTime() - SLOT_GRACE_MS
  );
  if (grid.length >= count) return grid.slice(0, count);

  const clock = pacificClock(now);
  const startMin = clock.ymd === day ? Math.max(SEND_START_MINUTE, clock.minutes + 1) : SEND_START_MINUTE;
  if (startMin > SEND_LAST_MINUTE) return grid.slice(0, count);
  const step = count <= 1 ? 0 : (SEND_LAST_MINUTE - startMin) / (count - 1);
  return Array.from({ length: count }, (_, index) => pacificLocalToIso(day, Math.round(startMin + step * index)));
}

export function formatPacificWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: PACIFIC,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPacificDay(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 20)).toLocaleDateString("en-US", {
    timeZone: PACIFIC,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function isAssociationProspect(name: string, organizationTypeKey: string | null | undefined): boolean {
  const key = (organizationTypeKey ?? "").toLowerCase();
  if (key.includes("association")) return true;
  return ASSOCIATION_NAME.test(name);
}

/**
 * 2027 Q1–Q2 first, then Q3, then dates at least six months out from 2027 Q4 onward.
 * Undated and past events stay off the automatic queue.
 */
export function eventDateBand(eventDate: string | null | undefined, todayYmd: string): EventDateBand {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return "excluded";
  if (eventDate < todayYmd) return "excluded";
  if (eventDate >= "2027-01-01" && eventDate <= "2027-06-30") return "q1q2_2027";
  if (eventDate >= "2027-07-01" && eventDate <= "2027-09-30") return "q3_2027";
  const horizon = addMonthsYmd(todayYmd, 6);
  if (eventDate >= "2027-10-01" && eventDate >= horizon) return "rolling";
  return "excluded";
}

export function bandRank(band: EventDateBand): number {
  if (band === "q1q2_2027") return 0;
  if (band === "q3_2027") return 1;
  if (band === "rolling") return 2;
  return 9;
}

export function autoSendSkipReason(input: AutoSendGateInput, todayYmd: string): string | null {
  if (input.queueStatus !== "pending" || input.queueKind !== "initial") return "not an open first-touch draft";
  if (input.doNotProspect || input.existingClient) return "held";
  if (input.alreadyContacted) return "already contacted";
  if (input.duplicateWarning) return "possible duplicate";
  if (isAssociationProspect(input.organizationName, input.organizationTypeKey)) return "association";
  if (!input.draftOpen) return "draft is not ready";
  if (!input.personName || !input.email) return "no named contact";
  if (input.blockedEmail) return "blocked address";
  if (input.emailVerificationStatus !== "verified_deliverable") return "email is not verified";
  if (input.totalScore == null || input.totalScore < AUTO_SEND_MIN_SCORE) return "score below 70";
  if (input.audienceScore == null || input.audienceScore < AUTO_SEND_MIN_AUDIENCE) return "audience below hall scale";
  if (input.budgetScore == null || input.budgetScore < AUTO_SEND_MIN_BUDGET) return "budget below keynote tier";
  if (eventDateBand(input.eventDate, todayYmd) === "excluded") return "event date is outside the window";
  return null;
}

export function componentScore(components: unknown, key: string): number | null {
  if (!components || typeof components !== "object") return null;
  const entry = (components as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object") return null;
  const score = (entry as { score?: unknown }).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}
