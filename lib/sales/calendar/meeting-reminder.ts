import type { calendar_v3 } from "googleapis";
import { getCalendarClient } from "./client";
import { CALENDAR_PRIMARY_ID, hasCalendarWriteScope, MEETING_REMINDER_PROP } from "./constants";
import { upsertCalendarStoreEvent } from "./store";
import type { SyncedCalendarEvent } from "./types";
import { getContact } from "../db/contacts";
import { getOrganization } from "../db/organizations";
import { getOpportunity, updateOpportunityImportMetadata, updateOpportunityTouchTimestamps } from "../db/opportunities";
import { deferPendingNudgesForOpportunity } from "../db/queue";
import { listOutreachActivitiesByTypes, mergeOutreachActivityMetadata } from "../db/activities";
import { getGmailClient } from "../gmail/client";
import { gmailThreadUrl } from "../gmail/constants";
import {
  coerceFollowUpIso,
  detectMeetingReminder,
  meetingReminderWindow,
  readMeetingReminders,
  textHasSchedulingAsk,
  upsertStoredMeetingReminder,
  type MeetingReminder,
  type StoredMeetingReminder,
} from "../follow-up/meeting-reminder";

export const MEETING_REMINDER_BACKFILL_DAYS = 45;

export type MeetingReminderRun = {
  scanned: number;
  scheduled: number;
  deferredNudges: number;
  errors: string[];
};

export type ScheduleMeetingReminderResult = {
  scheduled: boolean;
  date?: string;
  googleEventId?: string | null;
  importMetadata?: Record<string, unknown> | null;
  deferredNudges?: number;
  error?: string;
};

type GmailPayload = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPayload[] | null;
};

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextBody(payload: GmailPayload | null | undefined): string {
  if (!payload) return "";
  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractTextBody(part);
    if (text.trim()) return text;
  }
  if (payload.mimeType?.startsWith("text/html") && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function hintsAtDate(text: string): boolean {
  return /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|thanksgiving|new year|holidays?|next month|this month|end of the month)\b/i.test(
    text
  );
}

function reminderTitle(kind: MeetingReminder["kind"], organizationName: string): string {
  const name = organizationName.trim() || "Sales";
  return kind === "meeting" ? `Set meeting: ${name}` : `Reach out: ${name}`;
}

function reminderDescription(input: {
  reminder: MeetingReminder;
  organizationName: string;
  contactName: string | null;
  contactEmail: string | null;
  occurredAt: string | null;
  threadUrl: string | null;
}): string {
  const lead =
    input.reminder.kind === "meeting"
      ? "Set a meeting. This reminder is only on your calendar — the contact was not invited."
      : "Reach back out. This reminder is only on your calendar — the contact was not invited.";
  const when = input.occurredAt
    ? new Date(input.occurredAt).toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  return [
    lead,
    "",
    `Organization: ${input.organizationName}`,
    input.contactName
      ? `Contact: ${input.contactName}${input.contactEmail ? ` <${input.contactEmail}>` : ""}`
      : null,
    `They said: ${input.reminder.phrase}`,
    when ? `From the thread on ${when} (Pacific)` : null,
    "",
    input.reminder.excerpt,
    "",
    input.threadUrl ? `Gmail: ${input.threadUrl}` : null,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

async function loadPlainBody(
  gmailMessageId: string,
  loadBody?: (gmailMessageId: string) => Promise<string | null>
): Promise<string | null> {
  if (loadBody) return loadBody(gmailMessageId);
  const bundle = await getGmailClient();
  if (!bundle) return null;
  const full = await bundle.gmail.users.messages.get({ userId: "me", id: gmailMessageId, format: "full" });
  return extractTextBody(full.data.payload ?? null);
}

async function upsertGoogleReminder(input: {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  reminder: MeetingReminder;
  occurredAt: string | null;
  threadUrl: string | null;
}): Promise<{ googleEventId: string; htmlLink: string | null; startAt: string; endAt: string }> {
  const timing = meetingReminderWindow(input.reminder.date);
  if (!timing) throw new Error("Could not place the reminder on the calendar.");

  const bundle = await getCalendarClient();
  if (!bundle) throw new Error("Google account is not connected.");
  if (!hasCalendarWriteScope(bundle.scopes)) {
    throw new Error("Reconnect Google and allow Calendar so meeting reminders can be created.");
  }

  const key = `${input.opportunityId}:${input.reminder.date}`;
  const summary = reminderTitle(input.reminder.kind, input.organizationName);
  const description = reminderDescription({
    reminder: input.reminder,
    organizationName: input.organizationName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    occurredAt: input.occurredAt,
    threadUrl: input.threadUrl,
  });
  const body: calendar_v3.Schema$Event = {
    summary,
    description,
    start: { dateTime: timing.startAt, timeZone: "America/Los_Angeles" },
    end: { dateTime: timing.endAt, timeZone: "America/Los_Angeles" },
    reminders: { useDefault: true },
    extendedProperties: { private: { [MEETING_REMINDER_PROP]: key } },
  };

  const existing = await bundle.calendar.events.list({
    calendarId: CALENDAR_PRIMARY_ID,
    privateExtendedProperty: [`${MEETING_REMINDER_PROP}=${key}`],
    maxResults: 2,
    singleEvents: true,
    showDeleted: false,
  });
  const existingId = existing.data.items?.find((item) => item.id && item.status !== "cancelled")?.id ?? null;

  let googleEventId: string;
  let htmlLink: string | null = null;
  if (existingId) {
    const patched = await bundle.calendar.events.patch({
      calendarId: CALENDAR_PRIMARY_ID,
      eventId: existingId,
      sendUpdates: "none",
      requestBody: body,
    });
    googleEventId = patched.data.id ?? existingId;
    htmlLink = patched.data.htmlLink ?? null;
  } else {
    const inserted = await bundle.calendar.events.insert({
      calendarId: CALENDAR_PRIMARY_ID,
      sendUpdates: "none",
      requestBody: body,
    });
    if (!inserted.data.id) throw new Error("Google did not return an event id.");
    googleEventId = inserted.data.id;
    htmlLink = inserted.data.htmlLink ?? null;
  }

  const synced: SyncedCalendarEvent = {
    googleEventId,
    calendarId: CALENDAR_PRIMARY_ID,
    status: "confirmed",
    summary,
    description,
    location: null,
    htmlLink,
    hangoutLink: null,
    startAt: timing.startAt,
    endAt: timing.endAt,
    allDay: false,
    organizerEmail: bundle.email,
    attendeeEmails: [],
    contactId: input.contactId,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    opportunityId: input.opportunityId,
    matchStatus: "matched",
    syncedAt: new Date().toISOString(),
    source: "google",
    bloomId: null,
    bloomSlug: null,
  };
  await upsertCalendarStoreEvent(synced);
  return { googleEventId, htmlLink, startAt: timing.startAt, endAt: timing.endAt };
}

/**
 * Turn one correspondence into a private Google Calendar reminder when it names a future
 * meeting or callback. No attendees — an invite would email the prospect.
 */
export async function maybeScheduleMeetingReminder(input: {
  opportunityId: string;
  activityId?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  contactId?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  occurredAt?: string | null;
  fetchBody?: boolean;
  loadBody?: (gmailMessageId: string) => Promise<string | null>;
}): Promise<ScheduleMeetingReminderResult> {
  const opportunity = await getOpportunity(input.opportunityId);
  if (!opportunity) return { scheduled: false, error: "Opportunity not found" };
  if (opportunity.relationshipStage === "lost" || opportunity.relationshipStage === "purchase") {
    return { scheduled: false };
  }

  const markChecked = async () => {
    if (!input.activityId) return;
    await mergeOutreachActivityMetadata(input.activityId, { meetingReminderChecked: true }).catch(() => undefined);
  };

  const messageId = input.gmailMessageId ?? null;
  if (messageId && readMeetingReminders(opportunity.importMetadata).some((item) => item.gmailMessageId === messageId)) {
    await markChecked();
    return { scheduled: false, importMetadata: opportunity.importMetadata };
  }

  const reference = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const now = new Date();
  const head = [input.subject, input.snippet, input.body].filter(Boolean).join("\n");
  let reminder = detectMeetingReminder(head, now, reference);
  let fetchedBody = false;
  if (!reminder && input.fetchBody && messageId) {
    const short = (input.snippet ?? "").trim().length < 80;
    if (short || (hintsAtDate(head) && textHasSchedulingAsk(head))) {
      try {
        const body = await loadPlainBody(messageId, input.loadBody);
        fetchedBody = true;
        if (body) reminder = detectMeetingReminder([input.subject, input.snippet, body].filter(Boolean).join("\n"), now, reference);
      } catch (err) {
        return { scheduled: false, error: err instanceof Error ? err.message : "Could not read the email" };
      }
    }
  }

  if (!reminder) {
    if (!input.fetchBody || fetchedBody || !messageId) await markChecked();
    return { scheduled: false };
  }

  const organization = await getOrganization(opportunity.organizationId);
  const contact = input.contactId ? await getContact(input.contactId) : null;
  const organizationName = organization?.name?.trim() || opportunity.title || "Sales";
  const contactName = contact?.fullName?.trim() || null;
  const contactEmail = contact?.email?.trim() || null;

  let googleEventId: string | null = null;
  try {
    const saved = await upsertGoogleReminder({
      opportunityId: opportunity.id,
      organizationId: opportunity.organizationId,
      organizationName,
      contactId: contact?.id ?? input.contactId ?? null,
      contactName,
      contactEmail,
      reminder,
      occurredAt: input.occurredAt ?? null,
      threadUrl: input.gmailThreadId ? gmailThreadUrl(input.gmailThreadId) : null,
    });
    googleEventId = saved.googleEventId;
  } catch (err) {
    return { scheduled: false, error: err instanceof Error ? err.message : "Calendar reminder failed" };
  }

  const stored: StoredMeetingReminder = {
    date: reminder.date,
    kind: reminder.kind,
    phrase: reminder.phrase,
    gmailMessageId: messageId,
    googleEventId,
    contactId: contact?.id ?? input.contactId ?? null,
    contactName,
  };
  const importMetadata = upsertStoredMeetingReminder(opportunity.importMetadata, stored);
  await updateOpportunityImportMetadata(opportunity.id, importMetadata);
  const nextFollowUpAt = coerceFollowUpIso({ proposedIso: opportunity.nextFollowUpAt, importMetadata, now });
  if (nextFollowUpAt && nextFollowUpAt !== opportunity.nextFollowUpAt) {
    await updateOpportunityTouchTimestamps(opportunity.id, { nextFollowUpAt });
  }

  const note = `On your Google Calendar for ${reminder.date} (${reminder.phrase}). It stays out of the queue until that day.`;
  const deferredNudges = await deferPendingNudgesForOpportunity(opportunity.id, note);
  await markChecked();
  return { scheduled: true, date: reminder.date, googleEventId, importMetadata, deferredNudges };
}

/**
 * Recent replies and sends that named a later meeting or callback.
 * Idempotent: a message already checked, or already stored on the opportunity, is skipped.
 */
export async function backfillMeetingReminders(options?: {
  sinceDays?: number;
  maxBodyFetches?: number;
}): Promise<MeetingReminderRun> {
  const sinceDays = options?.sinceDays ?? MEETING_REMINDER_BACKFILL_DAYS;
  const maxBodyFetches = options?.maxBodyFetches ?? 30;
  const since = Date.now() - sinceDays * 86_400_000;
  const errors: string[] = [];
  let scanned = 0;
  let scheduled = 0;
  let deferredNudges = 0;
  let fetches = 0;

  const activities = await listOutreachActivitiesByTypes(["replied", "sent"], 2500);
  const recent = activities.filter((activity) => {
    const at = Date.parse(activity.occurredAt);
    return Number.isFinite(at) && at >= since;
  });

  let loadBody: ((gmailMessageId: string) => Promise<string | null>) | undefined;
  const bundle = await getGmailClient().catch(() => null);
  if (bundle) {
    loadBody = async (gmailMessageId: string) => {
      const full = await bundle.gmail.users.messages.get({ userId: "me", id: gmailMessageId, format: "full" });
      return extractTextBody(full.data.payload ?? null);
    };
  }

  for (const activity of recent) {
    const meta = activity.metadata ?? {};
    if (meta.meetingReminderChecked === true) continue;
    if (meta.replyKind === "auto") continue;
    scanned += 1;
    const subject = typeof meta.subject === "string" ? meta.subject : null;
    const snippet = typeof meta.snippet === "string" ? meta.snippet : null;
    const head = [subject, snippet].filter(Boolean).join("\n");
    const detectedOnSnippet = detectMeetingReminder(head, new Date(), new Date(activity.occurredAt));
    const wantsBody =
      !detectedOnSnippet &&
      Boolean(activity.gmailMessageId) &&
      (head.trim().length < 80 || (hintsAtDate(head) && textHasSchedulingAsk(head)));
    if (!detectedOnSnippet && !wantsBody) {
      await mergeOutreachActivityMetadata(activity.id, { meetingReminderChecked: true }).catch((err) => {
        errors.push(`${activity.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
      continue;
    }
    if (wantsBody && fetches >= maxBodyFetches) continue;
    if (wantsBody) fetches += 1;
    try {
      const result = await maybeScheduleMeetingReminder({
        opportunityId: activity.opportunityId,
        activityId: activity.id,
        gmailMessageId: activity.gmailMessageId,
        gmailThreadId: activity.gmailThreadId,
        contactId: activity.contactId,
        subject,
        snippet,
        occurredAt: activity.occurredAt,
        fetchBody: wantsBody,
        loadBody,
      });
      if (result.scheduled) scheduled += 1;
      deferredNudges += result.deferredNudges ?? 0;
      if (result.error) errors.push(`${activity.id}: ${result.error}`);
    } catch (err) {
      errors.push(`${activity.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scanned, scheduled, deferredNudges, errors };
}
