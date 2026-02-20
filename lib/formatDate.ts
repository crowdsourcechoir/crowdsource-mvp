/**
 * Shared date/time formatters. Used by event cards, admin list, and public event page
 * so the public page doesn't need to load the full EventCardTimeline bundle.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Parse YYYY-MM-DD as local date (avoid UTC midnight showing previous day). */
export function parseLocalDate(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || m < 1 || m > 12 || !d || d < 1) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimelineDate(dateStr: string): { short: string; dayOfWeek: string } {
  const d = parseLocalDate(dateStr);
  if (!d) return { short: dateStr, dayOfWeek: "" };
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const dayOfWeek = DAYS[d.getDay()];
  return { short: `${month} ${day}, ${year}`, dayOfWeek };
}

/** Format YYYY-MM-DD as "March 25, 2026" for display. */
export function formatDateLong(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Format time as "7pm" or "7:30pm" (lowercase, no minutes when :00). */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [hPart, mPart] = timeStr.split(":");
  const hour = parseInt(hPart ?? "0", 10);
  const min = mPart ? parseInt(mPart, 10) : 0;
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 || 12;
  return min ? `${h12}:${String(min).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
}
