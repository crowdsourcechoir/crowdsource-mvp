/** Google Calendar sync — scopes and windows for the sales meeting view. */

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

/** Look back this many days when syncing (inclusive of ongoing meetings). */
export const CALENDAR_SYNC_PAST_DAYS = 7;

/** Look ahead this many days for upcoming meetings. */
export const CALENDAR_SYNC_NEXT_DAYS = 30;

export const CALENDAR_PRIMARY_ID = "primary";

export function hasCalendarReadonlyScope(scopes: string[] | null | undefined): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.some(
    (scope) =>
      scope === GOOGLE_CALENDAR_READONLY_SCOPE ||
      scope === "https://www.googleapis.com/auth/calendar"
  );
}
