import type { calendar_v3 } from "googleapis";
import { getCalendarClient } from "../calendar/client";
import { CALENDAR_PRIMARY_ID, hasCalendarWriteScope } from "../calendar/constants";

/** One-minute follow-up appointments land on Joel’s calendar in Pacific time. */
export const FOLLOW_UP_EVENT_ZONE = "America/Los_Angeles";
export const FOLLOW_UP_CALENDAR_PROP = "cscFollowUpOpportunityId";

export function followUpEventWindow(iso: string): { start: string; end: string } | null {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: FOLLOW_UP_EVENT_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { start: `${date}T09:00:00`, end: `${date}T09:01:00` };
}

export async function syncFollowUpCalendarEvent(input: {
  opportunityId: string;
  organizationName: string;
  whenIso: string | null;
  existingEventId: string | null;
}): Promise<{ eventId: string | null; warning: string | null }> {
  const bundle = await getCalendarClient();
  if (!bundle) {
    return {
      eventId: input.existingEventId,
      warning: input.whenIso
        ? "Follow-up saved. Connect Google in Settings so this date can land on your calendar."
        : null,
    };
  }
  if (!hasCalendarWriteScope(bundle.scopes)) {
    return {
      eventId: input.existingEventId,
      warning: input.whenIso
        ? "Follow-up saved. Reconnect Google and allow Calendar write so this becomes a one-minute appointment."
        : null,
    };
  }

  if (!input.whenIso) {
    if (input.existingEventId) {
      try {
        await bundle.calendar.events.delete({
          calendarId: CALENDAR_PRIMARY_ID,
          eventId: input.existingEventId,
        });
      } catch (err) {
        const status = (err as { code?: number }).code;
        if (status !== 404 && status !== 410) {
          return {
            eventId: input.existingEventId,
            warning: "Follow-up cleared here. The calendar appointment could not be removed.",
          };
        }
      }
    }
    return { eventId: null, warning: null };
  }

  const window = followUpEventWindow(input.whenIso);
  if (!window) {
    return { eventId: input.existingEventId, warning: "Follow-up saved. The calendar time could not be read." };
  }

  const body: calendar_v3.Schema$Event = {
    summary: `Follow up: ${input.organizationName}`,
    description: "One-minute reminder from the sales organization page.",
    start: { dateTime: window.start, timeZone: FOLLOW_UP_EVENT_ZONE },
    end: { dateTime: window.end, timeZone: FOLLOW_UP_EVENT_ZONE },
    extendedProperties: {
      private: { [FOLLOW_UP_CALENDAR_PROP]: input.opportunityId },
    },
  };

  try {
    if (input.existingEventId) {
      const patched = await bundle.calendar.events.patch({
        calendarId: CALENDAR_PRIMARY_ID,
        eventId: input.existingEventId,
        requestBody: body,
      });
      return { eventId: patched.data.id ?? input.existingEventId, warning: null };
    }
    const inserted = await bundle.calendar.events.insert({
      calendarId: CALENDAR_PRIMARY_ID,
      requestBody: body,
    });
    if (!inserted.data.id) {
      return { eventId: null, warning: "Follow-up saved. Google did not return a calendar event." };
    }
    return { eventId: inserted.data.id, warning: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar update failed";
    return {
      eventId: input.existingEventId,
      warning: `Follow-up saved. Calendar was not updated (${message}).`,
    };
  }
}
