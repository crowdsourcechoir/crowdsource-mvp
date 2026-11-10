import { followUpFromDateInput } from "./calendar";

/**
 * Joel's calendar reminders are Pacific wall-clock dates.
 * Sales "today" stays America/Chicago; these dates are the calendar day itself.
 */
export const MEETING_REMINDER_TZ = "America/Los_Angeles";

export type MeetingReminderKind = "meeting" | "reach_out";

export type MeetingReminder = {
  /** YYYY-MM-DD in America/Los_Angeles. */
  date: string;
  kind: MeetingReminderKind;
  /** The time phrase that resolved, e.g. "end of November". */
  phrase: string;
  /** Short excerpt around the ask, for the calendar description. */
  excerpt: string;
};

export type StoredMeetingReminder = {
  date: string;
  kind: MeetingReminderKind;
  phrase: string;
  gmailMessageId: string | null;
  googleEventId: string | null;
  contactId: string | null;
  contactName: string | null;
};

type Ymd = { year: number; month: number; day: number };

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** Strong asks. Bare "meet" / "call" is not enough — those show up in conference blurbs. */
const STRONG_ASK =
  /\b(?:set(?:ting)?\s+up|schedul(?:e|ing)|let['’]?s|lets|let us|reach(?:ing)?\s+(?:back\s+)?out|circle\s+back|follow[\s-]?up|check\s+back|check\s+in|touch\s+base|(?:jump|hop|get)\s+on|book\s+(?:a\s+)?time|find\s+(?:a\s+)?time|grab\s+(?:a\s+)?time|pick\s+(?:a\s+)?time|get\s+back|reconnect|give\s+(?:me|you)\s+a\s+call|ping\s+(?:me|you|us))\b/i;

/** "meet" alone is an ask. "meeting" / "call" alone usually names an event, not a request. */
const WEAK_ASK = /\bmeet\b/i;

const EVENT_NOUN = /\b(?:conference|summit|expo|festival|keynote|webinar|convention|symposium)\b/i;

const PAST_LOCK = /\b(?:last\s+year|years?\s+ago|we\s+met|i\s+met|had\s+met)\b/i;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdKey(p: Ymd): number {
  return p.year * 10_000 + p.month * 100 + p.day;
}

function ymdString(p: Ymd): string {
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function ymdInReminderZone(date: Date): Ymd {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETING_REMINDER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bits = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(bits.year), month: Number(bits.month), day: Number(bits.day) };
}

function addDays(p: Ymd, days: number): Ymd {
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function weekday(p: Ymd): number {
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** First weekday on or after this civil day (Saturday → Monday, Sunday → Monday). */
function onOrAfterWeekday(p: Ymd): Ymd {
  const dow = weekday(p);
  if (dow === 6) return addDays(p, 2);
  if (dow === 0) return addDays(p, 1);
  return p;
}

/** Last weekday on or before this civil day (Saturday → Friday, Sunday → Friday). */
function onOrBeforeWeekday(p: Ymd): Ymd {
  const dow = weekday(p);
  if (dow === 6) return addDays(p, -1);
  if (dow === 0) return addDays(p, -2);
  return p;
}

function monthNumber(token: string): number | null {
  return MONTHS[token.toLowerCase().replace(/\.$/, "")] ?? null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampDay(year: number, month: number, day: number): Ymd | null {
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Early / first week → first weekday on or after the 2nd.
 * Mid → first weekday on or after the 15th.
 * Late / end → last weekday on or before the 24th.
 */
function anchorInMonth(year: number, month: number, slot: "early" | "mid" | "late" | "second"): Ymd | null {
  if (slot === "early") return onOrAfterWeekday({ year, month, day: 2 });
  if (slot === "second") return onOrAfterWeekday({ year, month, day: 8 });
  if (slot === "mid") return onOrAfterWeekday({ year, month, day: 15 });
  return onOrBeforeWeekday({ year, month, day: 24 });
}

function thanksgiving(year: number): Ymd {
  const nov1 = weekday({ year, month: 11, day: 1 });
  const firstThursday = 1 + ((4 - nov1 + 7) % 7);
  return { year, month: 11, day: firstThursday + 21 };
}

function shiftMonth(reference: Ymd, delta: number): { year: number; month: number } {
  const index = reference.year * 12 + (reference.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Drop a date that is already behind the message or behind today. Does not roll the year. */
function keepUpcoming(date: Ymd | null, reference: Ymd, now: Ymd): Ymd | null {
  if (!date) return null;
  if (ymdKey(date) < ymdKey(reference)) return null;
  if (ymdKey(date) < ymdKey(now)) return null;
  return date;
}

/** Month names before the reference month are next year. Weekday anchors use that year. */
function resolveMonthSlot(month: number, slot: "early" | "mid" | "late" | "second", reference: Ymd, now: Ymd): Ymd | null {
  const year = month < reference.month ? reference.year + 1 : reference.year;
  return keepUpcoming(anchorInMonth(year, month, slot), reference, now);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 0 && code < 0x10ffff ? String.fromCharCode(code) : _;
    });
}

function stripQuoted(body: string): string {
  const withoutSignature = body.split(/^\s*--\s*$/m)[0] ?? body;
  const lines = withoutSignature.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:$/.test(line.trim())) break;
    if (line.trim().startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

export function normalizeCorrespondence(text: string): string {
  return decodeEntities(stripQuoted(text))
    .replace(/([A-Za-z])[-–—]([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

type Hit = { start: number; end: number; phrase: string; date: Ymd };

function pushHit(hits: Hit[], start: number, end: number, phrase: string, date: Ymd | null) {
  if (!date) return;
  hits.push({ start, end, phrase: phrase.trim(), date });
}

function matchAll(text: string, re: RegExp): RegExpExecArray[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  const out: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = copy.exec(text))) out.push(match);
  return out;
}

function findHits(text: string, reference: Ymd, now: Ymd): Hit[] {
  const hits: Hit[] = [];

  const holiday =
    /\b(?:after\s+the\s+(?:holidays|holiday|new\s+year(?:'s)?)|in\s+the\s+new\s+year|after\s+new\s+year(?:'s)?)\b/gi;
  for (const match of matchAll(text, holiday)) {
    const year = reference.month === 1 && reference.day < 5 ? reference.year : reference.year + 1;
    const date = onOrAfterWeekday({ year, month: 1, day: 5 });
    pushHit(hits, match.index ?? 0, (match.index ?? 0) + match[0].length, match[0], keepUpcoming(date, reference, now));
  }

  const thanks = /\b(?:the\s+week\s+after|after)\s+thanksgiving\b/gi;
  for (const match of matchAll(text, thanks)) {
    let date = addDays(thanksgiving(reference.year), 4);
    if (ymdKey(date) < ymdKey(reference)) date = addDays(thanksgiving(reference.year + 1), 4);
    pushHit(hits, match.index ?? 0, (match.index ?? 0) + match[0].length, match[0], keepUpcoming(date, reference, now));
  }

  const qualified = new RegExp(
    `\\b(?:(early|beginning(?:\\s+of)?|start(?:\\s+of)?|first\\s+week(?:\\s+of)?)|(late|end(?:\\s+of)?|last\\s+week(?:\\s+of)?)|(mid(?:dle)?(?:\\s+of)?)|(second\\s+week(?:\\s+of)?)|(third\\s+week(?:\\s+of)?))\\s+(?:the\\s+)?(${MONTH_RE})\\b`,
    "gi"
  );
  for (const match of matchAll(text, qualified)) {
    const month = monthNumber(match[6] ?? "");
    if (!month) continue;
    const slot = match[1] ? "early" : match[2] ? "late" : match[4] ? "second" : "mid";
    pushHit(
      hits,
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      match[0],
      resolveMonthSlot(month, slot, reference, now)
    );
  }

  const weekOf = new RegExp(`\\b(first|1st|second|2nd|third|3rd|last)\\s+week\\s+of\\s+(${MONTH_RE})\\b`, "gi");
  for (const match of matchAll(text, weekOf)) {
    const month = monthNumber(match[2] ?? "");
    if (!month) continue;
    const word = (match[1] ?? "").toLowerCase();
    const slot =
      word.startsWith("f") || word === "1st" ? "early" : word.startsWith("s") || word === "2nd" ? "second" : word.startsWith("l") ? "late" : "mid";
    pushHit(
      hits,
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      match[0],
      resolveMonthSlot(month, slot, reference, now)
    );
  }

  const relative =
    /\b(?:(early\s+next\s+month|next\s+month)|(end\s+of\s+(?:the\s+)?month|later\s+this\s+month|end\s+of\s+this\s+month)|(early\s+this\s+month|beginning\s+of\s+(?:the\s+)?month)|(mid(?:dle)?\s+of\s+(?:the\s+)?month))\b/gi;
  for (const match of matchAll(text, relative)) {
    const next = Boolean(match[1]);
    const late = Boolean(match[2]);
    const early = Boolean(match[3]);
    const shifted = shiftMonth(reference, next ? 1 : 0);
    const slot = next || early ? "early" : late ? "late" : "mid";
    const anchored = anchorInMonth(shifted.year, shifted.month, slot);
    pushHit(
      hits,
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      match[0],
      keepUpcoming(anchored, reference, now)
    );
  }

  const namedDay = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  for (const match of matchAll(text, namedDay)) {
    const month = monthNumber(match[1] ?? "");
    const day = Number(match[2]);
    if (!month || !day) continue;
    const explicitYear = match[3] ? Number(match[3]) : null;
    const year = explicitYear ?? (month < reference.month ? reference.year + 1 : reference.year);
    pushHit(
      hits,
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      match[0],
      keepUpcoming(clampDay(year, month, day), reference, now)
    );
  }

  const inMonth = new RegExp(`\\bin\\s+(${MONTH_RE})\\b`, "gi");
  for (const match of matchAll(text, inMonth)) {
    const month = monthNumber(match[1] ?? "");
    if (!month) continue;
    pushHit(
      hits,
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      match[0],
      resolveMonthSlot(month, "early", reference, now)
    );
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Hit[] = [];
  let coveredUntil = -1;
  for (const hit of hits) {
    if (hit.start < coveredUntil) continue;
    kept.push(hit);
    coveredUntil = hit.end;
  }
  return kept;
}

function excerptAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 80);
  const to = Math.min(text.length, end + 80);
  const slice = text.slice(from, to).trim();
  return slice.length > 220 ? `${slice.slice(0, 217)}...` : slice;
}

function accepts(text: string, hit: Hit): boolean {
  const from = Math.max(0, hit.start - 160);
  const to = Math.min(text.length, hit.end + 80);
  const window = text.slice(from, to);
  const localFrom = Math.max(0, hit.start - 48);
  const localTo = Math.min(text.length, hit.end + 24);
  if (PAST_LOCK.test(text.slice(localFrom, localTo))) return false;
  const strong = STRONG_ASK.test(window);
  const weak = WEAK_ASK.test(window);
  if (!strong && !weak) return false;
  if (!strong && EVENT_NOUN.test(window)) return false;
  return true;
}

export function textHasSchedulingAsk(text: string): boolean {
  const normalized = normalizeCorrespondence(text);
  return STRONG_ASK.test(normalized) || WEAK_ASK.test(normalized);
}

function kindFor(text: string, hit: Hit): MeetingReminderKind {
  const from = Math.max(0, hit.start - 160);
  const to = Math.min(text.length, hit.end + 40);
  const window = text.slice(from, to);
  if (/\b(?:meet(?:ing)?|call|zoom|(?:jump|hop|get)\s+on)\b/i.test(window)) return "meeting";
  return "reach_out";
}

/**
 * Detect a future "let's meet at the end of November" / "reach back out in early December" ask.
 * Returns null when the date is already past, or when the time phrase is not next to a scheduling ask.
 */
export function detectMeetingReminder(
  text: string,
  now: Date = new Date(),
  reference: Date = now
): MeetingReminder | null {
  const normalized = normalizeCorrespondence(text);
  if (!normalized) return null;
  const nowYmd = ymdInReminderZone(now);
  const referenceYmd = ymdInReminderZone(reference);
  const hits = findHits(normalized, referenceYmd, nowYmd).filter((hit) => accepts(normalized, hit));
  if (hits.length === 0) return null;
  hits.sort((a, b) => ymdKey(a.date) - ymdKey(b.date));
  const soonest = ymdKey(hits[0].date);
  const chosen = hits.find((hit) => ymdKey(hit.date) === soonest && kindFor(normalized, hit) === "meeting") ?? hits[0];
  return {
    date: ymdString(chosen.date),
    kind: kindFor(normalized, chosen),
    phrase: chosen.phrase,
    excerpt: excerptAround(normalized, chosen.start, chosen.end),
  };
}

export function readMeetingReminders(metadata: Record<string, unknown> | null | undefined): StoredMeetingReminder[] {
  const raw = metadata?.meetingReminders;
  if (!Array.isArray(raw)) return [];
  const out: StoredMeetingReminder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.date !== "string" || !parseYmd(row.date)) continue;
    if (row.kind !== "meeting" && row.kind !== "reach_out") continue;
    out.push({
      date: row.date,
      kind: row.kind,
      phrase: typeof row.phrase === "string" ? row.phrase : "",
      gmailMessageId: typeof row.gmailMessageId === "string" ? row.gmailMessageId : null,
      googleEventId: typeof row.googleEventId === "string" ? row.googleEventId : null,
      contactId: typeof row.contactId === "string" ? row.contactId : null,
      contactName: typeof row.contactName === "string" ? row.contactName : null,
    });
  }
  return out;
}

export function soonestFutureReminder(metadata: Record<string, unknown> | null | undefined, now: Date = new Date()): StoredMeetingReminder | null {
  const today = ymdKey(ymdInReminderZone(now));
  const future = readMeetingReminders(metadata)
    .filter((item) => {
      const parsed = parseYmd(item.date);
      // Include the reminder day itself so a sync that morning cannot push the thread a week out.
      return parsed ? ymdKey(parsed) >= today : false;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return future[0] ?? null;
}

export function soonestFutureReminderYmd(metadata: Record<string, unknown> | null | undefined, now: Date = new Date()): string | null {
  return soonestFutureReminder(metadata, now)?.date ?? null;
}

/**
 * While the reminder day is still ahead or is today, do not mint another nudge.
 * Follow-ups shows the thread on that day because nextFollowUpAt is that calendar day.
 */
export function shouldHoldNudgeForMeetingReminder(metadata: Record<string, unknown> | null | undefined, now: Date = new Date()): boolean {
  return soonestFutureReminderYmd(metadata, now) != null;
}

/**
 * Automatic reply/outbound dates must not pull a held thread back into today's pile
 * before the reminder day. On that day the stored date is already due, so it stays put.
 */
export function coerceFollowUpIso(input: {
  proposedIso: string | null;
  importMetadata: Record<string, unknown> | null;
  now?: Date;
}): string | null {
  const date = soonestFutureReminderYmd(input.importMetadata, input.now ?? new Date());
  if (!date) return input.proposedIso;
  return followUpFromDateInput(date) ?? input.proposedIso;
}

export function upsertStoredMeetingReminder(
  metadata: Record<string, unknown> | null | undefined,
  reminder: StoredMeetingReminder
): Record<string, unknown> {
  const prev = metadata && typeof metadata === "object" ? { ...metadata } : {};
  const list = readMeetingReminders(prev);
  const index = list.findIndex((item) => item.date === reminder.date);
  if (index >= 0) {
    const current = list[index];
    list[index] = {
      ...current,
      ...reminder,
      googleEventId: reminder.googleEventId ?? current.googleEventId,
      gmailMessageId: reminder.gmailMessageId ?? current.gmailMessageId,
      contactId: reminder.contactId ?? current.contactId,
      contactName: reminder.contactName ?? current.contactName,
    };
  } else {
    list.push(reminder);
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  return { ...prev, meetingReminders: list };
}

export function parseMeetingReminderProperty(value: string | null | undefined): { opportunityId: string; date: string } | null {
  if (!value) return null;
  const match = /^([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i.exec(value.trim());
  if (!match) return null;
  return { opportunityId: match[1], date: match[2] };
}

/** 9:00–9:30am Pacific on the reminder day, as UTC instants. */
export function meetingReminderWindow(ymd: string): { startAt: string; endAt: string } | null {
  if (!parseYmd(ymd)) return null;
  const startAt = zonedLocalToUtcIso(ymd, "09:00", MEETING_REMINDER_TZ);
  if (!startAt) return null;
  const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString();
  return { startAt, endAt };
}

function zonedLocalToUtcIso(date: string, time: string, timeZone: string): string | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    let guess = Date.parse(`${date}T${time}:00.000Z`);
    if (Number.isNaN(guess)) return null;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value])) as Record<string, string>;
      const asUtc = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`);
      const intended = Date.parse(`${date}T${time}:00.000Z`);
      guess += intended - asUtc;
    }
    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}
