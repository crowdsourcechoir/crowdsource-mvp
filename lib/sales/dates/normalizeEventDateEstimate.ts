/**
 * Postgres `date` columns reject free-form LLM strings like "July 3–7, 2026" or "2027".
 * Coerce those into YYYY-MM-DD (preferring the start of a range) or null when unusable.
 */

const MONTH_INDEX: Record<string, number> = {
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

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_ONLY_RE = /^(?:19|20)\d{2}$/;
const MONTH_DAY_YEAR_RE =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:\s*[–—-]\s*\d{1,2})?,?\s+((?:19|20)\d{2})\b/i;
const MONTH_YEAR_RE =
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+((?:19|20)\d{2})\b/i;
const NUMERIC_SLASH_RE = /\b(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\b/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Returns a Postgres-safe YYYY-MM-DD, or null when the estimate is only a year / unparseable.
 * Ranges use the start day. Month+year alone uses the 1st of that month.
 */
export function normalizeEventDateEstimate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return null;

  const iso = trimmed.match(ISO_DATE_RE);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return toIso(year, month, day);
  }

  if (YEAR_ONLY_RE.test(trimmed)) return null;

  const monthDay = trimmed.match(MONTH_DAY_YEAR_RE);
  if (monthDay) {
    const month = MONTH_INDEX[monthDay[1]!.toLowerCase()];
    const day = Number(monthDay[2]);
    const year = Number(monthDay[3]);
    if (month) return toIso(year, month, day);
  }

  const slash = trimmed.match(NUMERIC_SLASH_RE);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    return toIso(year, month, day);
  }

  const monthYear = trimmed.match(MONTH_YEAR_RE);
  if (monthYear) {
    const month = MONTH_INDEX[monthYear[1]!.toLowerCase()];
    const year = Number(monthYear[2]);
    if (month) return toIso(year, month, 1);
  }

  return null;
}
