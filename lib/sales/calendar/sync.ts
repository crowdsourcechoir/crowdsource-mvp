import type { calendar_v3 } from "googleapis";
import { getCalendarClient } from "./client";
import {
  BLOOM_CALENDAR_PROP,
  CALENDAR_PRIMARY_ID,
  CALENDAR_SYNC_NEXT_DAYS,
  CALENDAR_SYNC_PAST_DAYS,
  MEETING_REMINDER_PROP,
  hasCalendarWriteScope,
} from "./constants";
import { backfillMeetingReminders } from "./meeting-reminder";
import { matchMeetingAttendees } from "./match";
import { EMPTY_CALENDAR_STORE, writeCalendarStore } from "./store";
import type { CalendarSyncResult, SyncedCalendarEvent } from "./types";
import { readBloomCalendarIds } from "@/lib/events/bloom-calendar-ids";
import { getOpportunity } from "../db/opportunities";
import { getOrganization } from "../db/organizations";
import { parseMeetingReminderProperty, readMeetingReminders } from "../follow-up/meeting-reminder";

function eventInstant(
  slot: calendar_v3.Schema$EventDateTime | null | undefined
): { iso: string | null; allDay: boolean } {
  if (!slot) return { iso: null, allDay: false };
  if (slot.dateTime) return { iso: new Date(slot.dateTime).toISOString(), allDay: false };
  if (slot.date) {
    // All-day dates are YYYY-MM-DD in the calendar's zone — store as UTC midnight.
    return { iso: new Date(`${slot.date}T00:00:00.000Z`).toISOString(), allDay: true };
  }
  return { iso: null, allDay: false };
}

function collectAttendeeEmails(event: calendar_v3.Schema$Event): string[] {
  const emails = new Set<string>();
  for (const attendee of event.attendees ?? []) {
    if (attendee.email) emails.add(attendee.email.trim().toLowerCase());
  }
  if (event.organizer?.email) emails.add(event.organizer.email.trim().toLowerCase());
  return Array.from(emails);
}

/**
 * Pull primary-calendar events in the sync window, match attendees to CRM contacts, and persist.
 */
export async function syncGoogleCalendar(): Promise<CalendarSyncResult> {
  const bundle = await getCalendarClient();
  if (!bundle) {
    return {
      synced: 0,
      matched: 0,
      unmatched: 0,
      cancelled: 0,
      window: { timeMin: "", timeMax: "" },
      lastSyncedAt: new Date().toISOString(),
      error: "Google account is not connected.",
    };
  }
  if (!bundle.calendarGranted) {
    return {
      synced: 0,
      matched: 0,
      unmatched: 0,
      cancelled: 0,
      window: { timeMin: "", timeMax: "" },
      lastSyncedAt: new Date().toISOString(),
      error:
        "Calendar access is not granted yet. Reconnect Google in Settings and allow Calendar when Google asks.",
    };
  }

  const now = Date.now();
  const timeMin = new Date(now - CALENDAR_SYNC_PAST_DAYS * 86_400_000).toISOString();
  const timeMax = new Date(now + CALENDAR_SYNC_NEXT_DAYS * 86_400_000).toISOString();
  const syncedAt = new Date().toISOString();

  const events: SyncedCalendarEvent[] = [];
  let pageToken: string | undefined;
  let cancelled = 0;
  const bloomIds = await readBloomCalendarIds();
  const googleIdToBloomId = new Map(Object.entries(bloomIds).map(([bloomId, gId]) => [gId, bloomId]));
  const reminderLinks = new Map<
    string,
    { organizationId: string; organizationName: string | null; contactId: string | null; contactName: string | null } | null
  >();

  async function reminderLink(opportunityId: string, date: string) {
    const cacheKey = `${opportunityId}:${date}`;
    if (reminderLinks.has(cacheKey)) return reminderLinks.get(cacheKey) ?? null;
    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) {
      reminderLinks.set(cacheKey, null);
      return null;
    }
    const organization = await getOrganization(opportunity.organizationId);
    const stored = readMeetingReminders(opportunity.importMetadata).find((item) => item.date === date) ?? null;
    const linked = {
      organizationId: opportunity.organizationId,
      organizationName: organization?.name ?? null,
      contactId: stored?.contactId ?? null,
      contactName: stored?.contactName ?? null,
    };
    reminderLinks.set(cacheKey, linked);
    return linked;
  }

  try {
    do {
      const res = await bundle.calendar.events.list({
        calendarId: CALENDAR_PRIMARY_ID,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      });

      for (const item of res.data.items ?? []) {
        if (!item.id) continue;
        if (item.status === "cancelled") {
          cancelled += 1;
          continue;
        }

        const start = eventInstant(item.start);
        const end = eventInstant(item.end);
        if (!start.iso) continue;

        const attendeeEmails = collectAttendeeEmails(item);
        const match = await matchMeetingAttendees({
          attendeeEmails,
          organizerEmail: item.organizer?.email ?? null,
          selfEmail: bundle.email,
        });

        const bloomIdFromProp = item.extendedProperties?.private?.[BLOOM_CALENDAR_PROP] ?? null;
        const bloomId = bloomIdFromProp || googleIdToBloomId.get(item.id) || null;
        const isBloom = Boolean(bloomId);
        const reminderKey = parseMeetingReminderProperty(item.extendedProperties?.private?.[MEETING_REMINDER_PROP]);
        const linked = reminderKey ? await reminderLink(reminderKey.opportunityId, reminderKey.date) : null;

        events.push({
          googleEventId: item.id,
          calendarId: CALENDAR_PRIMARY_ID,
          status: item.status ?? "confirmed",
          summary: item.summary?.trim() || "(No title)",
          description: item.description ?? null,
          location: item.location ?? null,
          htmlLink: item.htmlLink ?? null,
          hangoutLink: item.hangoutLink ?? null,
          startAt: start.iso,
          endAt: end.iso,
          allDay: start.allDay,
          organizerEmail: item.organizer?.email ?? null,
          attendeeEmails,
          contactId: match.contactId ?? linked?.contactId ?? null,
          contactName: match.contactName ?? linked?.contactName ?? null,
          contactEmail: match.contactEmail,
          organizationId: linked?.organizationId ?? match.organizationId,
          organizationName: linked?.organizationName ?? match.organizationName,
          opportunityId: linked ? reminderKey?.opportunityId ?? match.opportunityId : match.opportunityId,
          matchStatus: isBloom ? "self_only" : linked ? "matched" : match.matchStatus,
          syncedAt,
          source: isBloom ? "bloom" : "google",
          bloomId,
          bloomSlug: null,
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar sync failed";
    await writeCalendarStore({
      ...EMPTY_CALENDAR_STORE,
      lastSyncedAt: syncedAt,
      lastSyncError: message,
      window: { pastDays: CALENDAR_SYNC_PAST_DAYS, nextDays: CALENDAR_SYNC_NEXT_DAYS },
    });
    return {
      synced: 0,
      matched: 0,
      unmatched: 0,
      cancelled: 0,
      window: { timeMin, timeMax },
      lastSyncedAt: syncedAt,
      error: message,
    };
  }

  const matched = events.filter((e) => e.matchStatus === "matched").length;
  const unmatched = events.filter((e) => e.matchStatus === "unmatched").length;

  const written = await writeCalendarStore({
    lastSyncedAt: syncedAt,
    lastSyncError: null,
    window: { pastDays: CALENDAR_SYNC_PAST_DAYS, nextDays: CALENDAR_SYNC_NEXT_DAYS },
    events,
  });

  let meetingReminders: CalendarSyncResult["meetingReminders"];
  // When Calendar write is granted, push Blooms in the window onto Google if missing,
  // and turn recent "let's meet in December" threads into private calendar reminders.
  if (hasCalendarWriteScope(bundle.scopes)) {
    try {
      const { syncBloomsInCalendarWindow } = await import("@/lib/events/bloom-calendar-backfill");
      await syncBloomsInCalendarWindow({ timeMin, timeMax });
    } catch (err) {
      console.warn("[calendar-sync] bloom backfill skipped:", err);
    }
    try {
      meetingReminders = await backfillMeetingReminders();
    } catch (err) {
      meetingReminders = {
        scanned: 0,
        scheduled: 0,
        deferredNudges: 0,
        errors: [err instanceof Error ? err.message : "Meeting reminder backfill failed"],
      };
    }
  } else {
    meetingReminders = {
      scanned: 0,
      scheduled: 0,
      deferredNudges: 0,
      errors: ["Reconnect Google and allow Calendar so meeting reminders can be created."],
    };
  }

  return {
    synced: events.length,
    matched,
    unmatched,
    cancelled,
    window: { timeMin, timeMax },
    lastSyncedAt: syncedAt,
    error: written.error ?? undefined,
    meetingReminders,
  };
}
