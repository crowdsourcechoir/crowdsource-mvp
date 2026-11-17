import type { calendar_v3 } from "googleapis";
import { getCalendarClient } from "../calendar/client";
import { CALENDAR_PRIMARY_ID, hasCalendarWriteScope } from "../calendar/constants";
import { removeCalendarStoreEvent, upsertCalendarStoreEvent } from "../calendar/store";
import type { SyncedCalendarEvent } from "../calendar/types";
import { siteUrl } from "@/lib/site-url";

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

/** 9:00–9:01am Pacific on the follow-up’s calendar day, as UTC instants. */
export function followUpEventInstants(iso: string): { startAt: string; endAt: string } | null {
  const window = followUpEventWindow(iso);
  if (!window) return null;
  const startAt = zonedLocalToUtcIso(window.start.slice(0, 10), "09:00", FOLLOW_UP_EVENT_ZONE);
  if (!startAt) return null;
  return { startAt, endAt: new Date(Date.parse(startAt) + 60_000).toISOString() };
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
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value])) as Record<
        string,
        string
      >;
      const asUtc = Date.parse(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000Z`
      );
      const intended = Date.parse(`${date}T${time}:00.000Z`);
      guess += intended - asUtc;
    }
    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}

async function findFollowUpEventId(
  calendar: calendar_v3.Calendar,
  opportunityId: string
): Promise<string | null> {
  const listed = await calendar.events.list({
    calendarId: CALENDAR_PRIMARY_ID,
    privateExtendedProperty: [`${FOLLOW_UP_CALENDAR_PROP}=${opportunityId}`],
    timeMin: new Date(Date.now() - 86_400_000).toISOString(),
    timeMax: new Date(Date.now() + 800 * 86_400_000).toISOString(),
    singleEvents: true,
    maxResults: 5,
    showDeleted: false,
  });
  const hit = (listed.data.items ?? []).find((item) => item.id && item.status !== "cancelled");
  return hit?.id ?? null;
}

export async function syncFollowUpCalendarEvent(input: {
  opportunityId: string;
  organizationName: string;
  whenIso: string | null;
  existingEventId: string | null;
  summary?: string | null;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  organizationId?: string | null;
}): Promise<{ eventId: string | null; htmlLink: string | null; warning: string | null }> {
  const bundle = await getCalendarClient();
  if (!bundle) {
    return {
      eventId: input.existingEventId,
      htmlLink: null,
      warning: input.whenIso
        ? "Follow-up saved. Connect Google in Settings so this date can land on your calendar."
        : null,
    };
  }
  if (!hasCalendarWriteScope(bundle.scopes)) {
    return {
      eventId: input.existingEventId,
      htmlLink: null,
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
          sendUpdates: "none",
        });
        await removeCalendarStoreEvent(input.existingEventId);
      } catch (err) {
        const status = (err as { code?: number }).code;
        if (status !== 404 && status !== 410) {
          return {
            eventId: input.existingEventId,
            htmlLink: null,
            warning: "Follow-up cleared here. The calendar appointment could not be removed.",
          };
        }
        await removeCalendarStoreEvent(input.existingEventId);
      }
    }
    return { eventId: null, htmlLink: null, warning: null };
  }

  const window = followUpEventWindow(input.whenIso);
  const instants = followUpEventInstants(input.whenIso);
  if (!window || !instants) {
    return {
      eventId: input.existingEventId,
      htmlLink: null,
      warning: "Follow-up saved. The calendar time could not be read.",
    };
  }

  const summary = input.summary?.trim() || `Follow up: ${input.organizationName}`;
  const description =
    input.description?.trim() ||
    `One-minute reminder from the sales organization page.\n\nOpen the deal: ${dealUrl(input.opportunityId)}`;

  const body: calendar_v3.Schema$Event = {
    summary,
    description,
    start: { dateTime: window.start, timeZone: FOLLOW_UP_EVENT_ZONE },
    end: { dateTime: window.end, timeZone: FOLLOW_UP_EVENT_ZONE },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
    extendedProperties: {
      private: { [FOLLOW_UP_CALENDAR_PROP]: input.opportunityId },
    },
  };

  try {
    let eventId = input.existingEventId ?? (await findFollowUpEventId(bundle.calendar, input.opportunityId));
    let htmlLink: string | null = null;
    if (eventId) {
      const patched = await bundle.calendar.events.patch({
        calendarId: CALENDAR_PRIMARY_ID,
        eventId,
        sendUpdates: "none",
        requestBody: body,
      });
      eventId = patched.data.id ?? eventId;
      htmlLink = patched.data.htmlLink ?? null;
    } else {
      const inserted = await bundle.calendar.events.insert({
        calendarId: CALENDAR_PRIMARY_ID,
        sendUpdates: "none",
        requestBody: body,
      });
      if (!inserted.data.id) {
        return { eventId: null, htmlLink: null, warning: "Follow-up saved. Google did not return a calendar event." };
      }
      eventId = inserted.data.id;
      htmlLink = inserted.data.htmlLink ?? null;
    }

    await upsertCalendarStoreEvent(
      toStoreEvent({
        googleEventId: eventId,
        summary,
        description,
        htmlLink,
        startAt: instants.startAt,
        endAt: instants.endAt,
        organizerEmail: bundle.email,
        opportunityId: input.opportunityId,
        organizationId: input.organizationId ?? null,
        organizationName: input.organizationName,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
      })
    );
    return { eventId, htmlLink, warning: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar update failed";
    return {
      eventId: input.existingEventId,
      htmlLink: null,
      warning: `Follow-up saved. Calendar was not updated (${message}).`,
    };
  }
}

function dealUrl(opportunityId: string): string {
  return `${siteUrl()}/admin/sales/opportunities/${opportunityId}`;
}

function toStoreEvent(input: {
  googleEventId: string;
  summary: string;
  description: string;
  htmlLink: string | null;
  startAt: string;
  endAt: string;
  organizerEmail: string;
  opportunityId: string;
  organizationId: string | null;
  organizationName: string;
  contactName: string | null;
  contactEmail: string | null;
}): SyncedCalendarEvent {
  return {
    googleEventId: input.googleEventId,
    calendarId: CALENDAR_PRIMARY_ID,
    status: "confirmed",
    summary: input.summary,
    description: input.description,
    location: null,
    htmlLink: input.htmlLink,
    hangoutLink: null,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: false,
    organizerEmail: input.organizerEmail,
    attendeeEmails: [],
    contactId: null,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    opportunityId: input.opportunityId,
    matchStatus: "matched",
    syncedAt: new Date().toISOString(),
    source: "check_in",
  };
}
