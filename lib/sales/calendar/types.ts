export type CalendarMatchStatus = "matched" | "unmatched" | "self_only";

export type SyncedCalendarEvent = {
  googleEventId: string;
  calendarId: string;
  status: string;
  summary: string;
  description: string | null;
  location: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  organizerEmail: string | null;
  attendeeEmails: string[];
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  opportunityId: string | null;
  matchStatus: CalendarMatchStatus;
  syncedAt: string;
};

export type CalendarSyncStore = {
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  window: { pastDays: number; nextDays: number };
  events: SyncedCalendarEvent[];
};

export type CalendarSyncResult = {
  synced: number;
  matched: number;
  unmatched: number;
  cancelled: number;
  window: { timeMin: string; timeMax: string };
  lastSyncedAt: string;
  error?: string;
};
