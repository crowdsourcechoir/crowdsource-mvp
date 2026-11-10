/** Google Calendar sync — scopes and windows for the sales meeting view. */

export const GOOGLE_CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

/** Full calendar — needed to create/update Bloom events on Google. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

/** Look back this many days when syncing (had / recent meetings with contacts). */
export const CALENDAR_SYNC_PAST_DAYS = 90;

/**
 * Look ahead this many days for upcoming meetings.
 * 90 covers “early December” / “after the new year” reminders created in November.
 */
export const CALENDAR_SYNC_NEXT_DAYS = 90;

export const CALENDAR_PRIMARY_ID = "primary";

/** Private extended property key written onto Bloom Google events. */
export const BLOOM_CALENDAR_PROP = "cscBloomId";

/** Private extended property on Joel-only meeting reminders. Value is `opportunityId:YYYY-MM-DD`. */
export const MEETING_REMINDER_PROP = "cscMeetingReminder";

export function hasCalendarReadonlyScope(scopes: string[] | null | undefined): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.some(
    (scope) =>
      scope === GOOGLE_CALENDAR_READONLY_SCOPE ||
      scope === GOOGLE_CALENDAR_SCOPE ||
      scope === "https://www.googleapis.com/auth/calendar.events"
  );
}

export function hasCalendarWriteScope(scopes: string[] | null | undefined): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.some(
    (scope) => scope === GOOGLE_CALENDAR_SCOPE || scope === "https://www.googleapis.com/auth/calendar.events"
  );
}
