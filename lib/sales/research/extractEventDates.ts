/**
 * Deterministic calendar-date extraction for event pages.
 *
 * The LLM research pass often tags event *names* ("2027 NAEA National Convention") as
 * `event_date` while missing the actual "March 4–6, 2027" line sitting on the same page.
 * This pure helper recovers those dates from already-fetched page text so timing scores
 * and drafts can use a real calendar date when the site published one.
 */

export type ExtractedEventDate = {
  claimText: string;
  claimValueText: string;
  confidence: number;
};

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/** March 4-6, 2027 | March 4–6, 2027 | March 4, 2027 */
const DATE_RANGE_RE = new RegExp(
  `\\b(${MONTH})\\s+(\\d{1,2})(?:\\s*[–—-]\\s*(\\d{1,2}))?,?\\s+((?:19|20)\\d{2})\\b`,
  "gi"
);

/** March 4, 2027, 8:00 AM – March 6, 2027, 5:00 PM */
const DATE_SPAN_RE = new RegExp(
  `\\b(${MONTH})\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})\\b[^.\\n]{0,40}?[–—-]\\s*(${MONTH})\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})\\b`,
  "gi"
);

const EVENT_CONTEXT_RE =
  /\b(convention|conference|summit|symposium|annual meeting|gala|festival|congress|expo|retreat|dates?\s*:)/i;

const MAX_DATES_PER_PAGE = 4;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatRange(month: string, startDay: string, endDay: string | undefined, year: string): string {
  const m = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
  if (endDay && endDay !== startDay) return `${m} ${startDay}–${endDay}, ${year}`;
  return `${m} ${startDay}, ${year}`;
}

function contextAround(text: string, index: number, radius = 90): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function hasEventContext(snippet: string): boolean {
  return EVENT_CONTEXT_RE.test(snippet);
}

/**
 * Pulls calendar dates from page text, preferring ones near event/convention wording
 * or an explicit "Dates:" label. Returns at most a few high-signal dates per page.
 */
export function extractCalendarEventDates(pageText: string): ExtractedEventDate[] {
  if (!pageText || pageText.length < 20) return [];

  const normalized = pageText.replace(/\u00a0/g, " ");
  const seen = new Set<string>();
  const withContext: ExtractedEventDate[] = [];
  const withoutContext: ExtractedEventDate[] = [];

  const push = (value: string, index: number, claimText: string, confidence: number) => {
    const claimValueText = normalizeWhitespace(value);
    const key = claimValueText.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const entry: ExtractedEventDate = { claimText, claimValueText, confidence };
    if (hasEventContext(contextAround(normalized, index))) withContext.push(entry);
    else withoutContext.push(entry);
  };

  DATE_SPAN_RE.lastIndex = 0;
  let span: RegExpExecArray | null;
  while ((span = DATE_SPAN_RE.exec(normalized))) {
    const [, m1, d1, y1, m2, d2, y2] = span;
    if (!m1 || !d1 || !y1 || !m2 || !d2 || !y2) continue;
    const value =
      m1.toLowerCase() === m2.toLowerCase() && y1 === y2
        ? formatRange(m1, d1, d2, y1)
        : `${formatRange(m1, d1, undefined, y1)} – ${formatRange(m2, d2, undefined, y2)}`;
    push(value, span.index, `Event dates on page: ${value}`, 0.9);
  }

  DATE_RANGE_RE.lastIndex = 0;
  let range: RegExpExecArray | null;
  while ((range = DATE_RANGE_RE.exec(normalized))) {
    const [, month, startDay, endDay, year] = range;
    if (!month || !startDay || !year) continue;
    const value = formatRange(month, startDay, endDay, year);
    push(value, range.index, `Event date on page: ${value}`, endDay ? 0.88 : 0.8);
  }

  // Prefer dates near convention/conference wording; fall back to bare dates only if none.
  const preferred = withContext.length > 0 ? withContext : withoutContext;
  return preferred.slice(0, MAX_DATES_PER_PAGE);
}

/** True when claim text already carries a usable calendar date (month + day or full range). */
export function claimLooksLikeCalendarDate(text: string): boolean {
  if (!text) return false;
  // Fresh non-global copies — RegExp.test with /g is stateful via lastIndex.
  const range = new RegExp(DATE_RANGE_RE.source, "i");
  const span = new RegExp(DATE_SPAN_RE.source, "i");
  return range.test(text) || span.test(text);
}
