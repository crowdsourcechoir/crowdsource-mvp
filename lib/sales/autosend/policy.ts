import { classifyDealType } from "@/lib/sales/business-model";
import { isGenericMailboxEmail } from "@/lib/sales/dedupe";

/**
 * Weekday send window and who is allowed into the automated 25/day queue.
 * Research can run any time. Outreach leaves only during this window.
 */

export const PACIFIC = "America/Los_Angeles";
export const AUTO_SEND_DAILY_CAP = 25;
export const AUTO_SEND_WEEKLY_CAP = 175;
export const AUTO_SEND_HORIZON_DAYS = 30;
export const AUTO_SEND_MIN_SCORE = 70;
export const AUTO_SEND_MIN_AUDIENCE = 6;
export const AUTO_SEND_MIN_BUDGET = 6;
/** Anthem fee that counts as a large opportunity. Fundraiser goals of about $500k land here. */
export const AUTO_SEND_MIN_FEE = 15_000;

/**
 * $15k+ lineup only: 18 large ($15k+ Anthem), 2 sponsorship, 3 partnership, 0 other.
 * School auctions and sub-$15k local fundraisers stay off the automated lineup.
 */
export const AUTO_SEND_LANES = ["large", "sponsorship", "partnership", "other"] as const;
export type AutoSendLane = (typeof AUTO_SEND_LANES)[number];
export const LANE_DAILY_QUOTA: Record<AutoSendLane, number> = {
  large: 20,
  sponsorship: 2,
  partnership: 3,
  other: 0,
};
export const LANE_LABEL: Record<AutoSendLane, string> = {
  large: "Large",
  sponsorship: "Sponsorship",
  partnership: "Partnership",
  other: "Other",
};
export const SEND_START_MINUTE = 8 * 60;
export const SEND_LAST_MINUTE = 16 * 60 + 30;
export const WINDOW_END_MINUTE = 17 * 60;

const ASSOCIATION_NAME =
  /\b(association|society|council|chapter|federation|coalition)\b/i;
const CHAPTER_NAME = /\b(society|council|chapter|federation|coalition)\b/i;
const SCHOOL_NAME = /\b(schools?|academ(?:y|ies)|ptsa|pta|preparatory|elementary|high school|middle school)\b/i;
const GALA_NAME = /\bauction\b|\bgala\b|fundrais|benefit dinner|charity ball/i;
const STATE_OR_REGIONAL =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|regional)\b/i;

export type EventDateBand = "q1q2_2027" | "q3_2027" | "rolling" | "annual_tbd" | "excluded";

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
  eventTitle?: string | null;
  opportunityTypeKey?: string | null;
  salesInitiative?: string | null;
  suggestedFee?: number | null;
  potentialAmount?: number | null;
  dealType?: string | null;
  category?: string | null;
};

export type AutoSendLaneInput = {
  organizationName?: string | null;
  eventTitle?: string | null;
  organizationTypeKey?: string | null;
  opportunityTypeKey?: string | null;
  salesInitiative?: string | null;
  suggestedFee?: number | null;
  potentialAmount?: number | null;
  dealType?: string | null;
  category?: string | null;
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

function pricedAtLeastFee(fee: number | null | undefined, potential: number | null | undefined): boolean {
  return (fee != null && fee >= AUTO_SEND_MIN_FEE) || (potential != null && potential >= AUTO_SEND_MIN_FEE);
}

function explicitlyPricedUnderFee(fee: number | null | undefined, potential: number | null | undefined): boolean {
  if (pricedAtLeastFee(fee, potential)) return false;
  return (fee != null && fee > 0 && fee < AUTO_SEND_MIN_FEE) || (potential != null && potential > 0 && potential < AUTO_SEND_MIN_FEE);
}

/**
 * Large is a $15k+ Anthem buyer (national or corporate conference, or a gala priced at $15k+).
 * Sponsorship and partnership are their own lanes. School auctions, sub-$15k regional conferences,
 * and unpriced local galas land in Other (which is excluded from the automated lineup).
 */
export function classifyAutoSendLane(input: AutoSendLaneInput): AutoSendLane {
  const name = input.organizationName ?? "";
  const title = input.eventTitle ?? "";
  const text = `${name} ${title}`;
  if (SCHOOL_NAME.test(name) || SCHOOL_NAME.test(title)) return "other";

  const orgType = (input.organizationTypeKey ?? "").toLowerCase();
  const oppType = (input.opportunityTypeKey ?? "").toLowerCase();
  const initiative = input.salesInitiative ?? "";
  const deal = classifyDealType({
    dealType: input.dealType,
    salesInitiative: input.salesInitiative,
    organizationTypeKey: input.organizationTypeKey,
    opportunityTitle: text,
    category: input.category,
  });
  if (deal === "sponsorship") return "sponsorship";
  if (deal !== "client_booking") return "partnership";

  if (explicitlyPricedUnderFee(input.suggestedFee, input.potentialAmount)) {
    return "other";
  }

  const priced = pricedAtLeastFee(input.suggestedFee, input.potentialAmount);
  if (oppType === "fundraising_gala" || GALA_NAME.test(text)) {
    return priced ? "large" : "other";
  }

  if (
    priced ||
    oppType === "annual_conference" ||
    oppType === "association_convention" ||
    orgType === "conference" ||
    initiative === "conferences_associations" ||
    initiative === "tech_conferences"
  ) {
    return "large";
  }

  return "other";
}

/**
 * Chapters, societies, councils, and state or regional associations stay off the line.
 * A national conference may be typed as an association and still take a Large seat.
 */
export function associationBlocksAutoSend(
  name: string,
  organizationTypeKey: string | null | undefined,
  lane: AutoSendLane
): boolean {
  if (CHAPTER_NAME.test(name)) {
    if (lane === "large" && !STATE_OR_REGIONAL.test(name) && !/\b(chapter|regional|local)\b/i.test(name)) {
      return false;
    }
    return true;
  }
  const association =
    (organizationTypeKey ?? "").toLowerCase().includes("association") || /\bassociation\b/i.test(name);
  if (!association) return false;
  if (STATE_OR_REGIONAL.test(name)) return true;
  return lane !== "large";
}

/**
 * 2027 Q1–Q2 first, then Q3, then dates at least six months out from 2027 Q4 onward.
 * Undated and past events stay off Large and Other. Sponsorship and partnership may be a season with no single date.
 */
export function eventDateBand(eventDate: string | null | undefined, todayYmd: string): EventDateBand {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return "annual_tbd";
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
  if (band === "annual_tbd") return 3;
  return 9;
}

export function autoSendSkipReason(input: AutoSendGateInput, todayYmd: string): string | null {
  if (input.queueStatus !== "pending" || input.queueKind !== "initial") return "not an open first-touch draft";
  if (input.doNotProspect || input.existingClient) return "held";
  if (input.alreadyContacted) return "already contacted";
  if (input.duplicateWarning) return "possible duplicate";
  const lane = classifyAutoSendLane(input);
  if (lane === "other") return "below $15k tier";
  if (associationBlocksAutoSend(input.organizationName, input.organizationTypeKey, lane)) return "association";
  if (!input.draftOpen) return "draft is not ready";
  if (!input.personName || !input.email) return "no named contact";
  if (isGenericMailboxEmail(input.email)) return "generic inbox";
  if (input.blockedEmail) return "blocked address";
  if (
    input.emailVerificationStatus !== "verified_deliverable" &&
    input.emailVerificationStatus !== "valid_format"
  ) {
    return "email is not verified";
  }
  if (input.totalScore == null || input.totalScore < AUTO_SEND_MIN_SCORE) return "score below 70";
  if (input.audienceScore == null || input.audienceScore < AUTO_SEND_MIN_AUDIENCE) return "audience below hall scale";
  if (input.budgetScore == null || input.budgetScore < AUTO_SEND_MIN_BUDGET) return "budget below keynote tier";
  const band = eventDateBand(input.eventDate, todayYmd);
  if (band === "excluded") {
    return "event date is outside the window";
  }
  if (band === "annual_tbd") {
    const seasonal = lane === "sponsorship" || lane === "partnership";
    const pricedLarge =
      lane === "large" && pricedAtLeastFee(input.suggestedFee, input.potentialAmount);
    if (!seasonal && !pricedLarge) return "event date is outside the window";
  }
  return null;
}

export function componentScore(components: unknown, key: string): number | null {
  if (!components || typeof components !== "object") return null;
  const entry = (components as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object") return null;
  const score = (entry as { score?: unknown }).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}
