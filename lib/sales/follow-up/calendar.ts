/** Joel works US Central. Follow-up “today” is that calendar day, not UTC. */
export const SALES_TIME_ZONE = "America/Chicago";

export type FollowUpPreset = "today" | "tomorrow" | "in_3_days" | "next_week";

const PRESET_DAYS: Record<FollowUpPreset, number> = {
  today: 0,
  tomorrow: 1,
  in_3_days: 3,
  next_week: 7,
};

export type CalendarDay = { year: number; month: number; day: number };

function partsInZone(date: Date, timeZone: string = SALES_TIME_ZONE): CalendarDay {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bits = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(bits.year), month: Number(bits.month), day: Number(bits.day) };
}

function dayKey(day: CalendarDay): number {
  return day.year * 10_000 + day.month * 100 + day.day;
}

/** Noon UTC on that calendar day — stored timestamps only need a stable date, not a precise hour. */
export function salesDayNoonIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 17, 0, 0)).toISOString(); // 11:00 CT / 12:00 CT depending on DST; date is what matters
}

export function addCalendarDays(year: number, month: number, day: number, days: number): CalendarDay {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export function salesTodayParts(now: Date = new Date(), timeZone: string = SALES_TIME_ZONE): CalendarDay {
  return partsInZone(now, timeZone);
}

export function followUpPresetIso(preset: FollowUpPreset, now: Date = new Date(), timeZone: string = SALES_TIME_ZONE): string {
  const today = partsInZone(now, timeZone);
  const target = addCalendarDays(today.year, today.month, today.day, PRESET_DAYS[preset]);
  if (preset === "today") return now.toISOString();
  return salesDayNoonIso(target.year, target.month, target.day);
}

export function followUpFromDateInput(ymd: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return salesDayNoonIso(year, month, day);
}

export function isFollowUpDueOnOrBeforeToday(iso: string | null, now: Date = new Date(), timeZone: string = SALES_TIME_ZONE): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return dayKey(partsInZone(date, timeZone)) <= dayKey(partsInZone(now, timeZone));
}

export function isFollowUpOverdue(iso: string | null, now: Date = new Date(), timeZone: string = SALES_TIME_ZONE): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return dayKey(partsInZone(date, timeZone)) < dayKey(partsInZone(now, timeZone));
}

export function formatFollowUpDay(iso: string | null, timeZone: string = SALES_TIME_ZONE): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" });
}

export function ymdInSalesZone(iso: string | null, timeZone: string = SALES_TIME_ZONE): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
