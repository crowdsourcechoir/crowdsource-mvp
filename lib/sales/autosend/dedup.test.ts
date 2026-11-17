import assert from "node:assert/strict";
import type { SyncedCalendarEvent } from "@/lib/sales/calendar/types";
import { buildPriorOutreachIndex, priorOutreachSkipReason } from "./dedup";

function calendarEvent(overrides: Partial<SyncedCalendarEvent> = {}): SyncedCalendarEvent {
  return {
    googleEventId: "evt-1",
    calendarId: "primary",
    status: "confirmed",
    summary: "Intro call",
    description: null,
    location: null,
    htmlLink: null,
    hangoutLink: null,
    startAt: "2026-11-12T19:00:00.000Z",
    endAt: "2026-11-12T19:30:00.000Z",
    allDay: false,
    organizerEmail: "sing@crowdsourcechoir.com",
    attendeeEmails: ["sing@crowdsourcechoir.com"],
    contactId: null,
    contactName: null,
    contactEmail: null,
    organizationId: null,
    organizationName: null,
    opportunityId: null,
    matchStatus: "unmatched",
    syncedAt: "2026-11-17T09:15:00.000Z",
    source: "google",
    bloomId: null,
    bloomSlug: null,
    ...overrides,
  };
}

function main() {
  // 1. Sibling opportunity on the same organization was already emailed (Carrie / Washington State Fair scenario).
  const crossOppIndex = buildPriorOutreachIndex({
    opportunities: [
      {
        id: "opp-old",
        organization_id: "org-wsf",
        last_outbound_at: "2026-11-10T18:00:00.000Z",
        last_inbound_at: null,
        gmail_thread_id: "th-wsf-1",
        relationship_stage: "awareness",
      },
      {
        id: "opp-new",
        organization_id: "org-wsf",
        last_outbound_at: null,
        last_inbound_at: null,
        gmail_thread_id: null,
        relationship_stage: null,
      },
    ],
    contacts: [
      {
        id: "c-carrie-new",
        organization_id: "org-wsf",
        email: "carrie@thefair.com",
        normalized_email: "carrie@thefair.com",
      },
    ],
    activities: [],
    approvedDrafts: [],
    calendarEvents: [],
    selfEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(
    priorOutreachSkipReason(crossOppIndex, {
      opportunityId: "opp-new",
      organizationId: "org-wsf",
      contactId: "c-carrie-new",
      email: "carrie@thefair.com",
    }),
    "already contacted",
    "a second opportunity on an already-contacted organization must be skipped"
  );

  // 2. Duplicate organization row sharing the same contact email that already has a sent activity.
  const crossEmailIndex = buildPriorOutreachIndex({
    opportunities: [
      {
        id: "opp-wsf-2",
        organization_id: "org-wsf-dup",
        last_outbound_at: null,
        last_inbound_at: null,
        gmail_thread_id: null,
        relationship_stage: null,
      },
    ],
    contacts: [
      {
        id: "c-carrie-1",
        organization_id: "org-wsf-1",
        email: "carrie@thefair.com",
        normalized_email: "carrie@thefair.com",
      },
      {
        id: "c-carrie-2",
        organization_id: "org-wsf-dup",
        email: "CARRIE@thefair.com",
        normalized_email: "carrie@thefair.com",
      },
    ],
    activities: [
      {
        opportunity_id: "opp-wsf-1",
        contact_id: "c-carrie-1",
        activity_type: "sent",
        metadata: { kind: "initial" },
      },
    ],
    approvedDrafts: [],
    calendarEvents: [],
    selfEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(
    priorOutreachSkipReason(crossEmailIndex, {
      opportunityId: "opp-wsf-2",
      organizationId: "org-wsf-dup",
      contactId: "c-carrie-2",
      email: "carrie@thefair.com",
    }),
    "already contacted",
    "prior sent activity on the same normalized email must block duplicate org/contact rows"
  );

  // 3. Calendar meeting attendee match even when opportunity has no last_outbound_at (Kyle Hoob scenario).
  const meetingIndex = buildPriorOutreachIndex({
    opportunities: [
      {
        id: "opp-gonzaga",
        organization_id: "org-gonzaga",
        last_outbound_at: null,
        last_inbound_at: null,
        gmail_thread_id: null,
        relationship_stage: null,
      },
    ],
    contacts: [
      {
        id: "c-kyle",
        organization_id: "org-gonzaga",
        email: "hoob@gonzaga.edu",
        normalized_email: "hoob@gonzaga.edu",
      },
    ],
    activities: [],
    approvedDrafts: [],
    calendarEvents: [
      calendarEvent({
        googleEventId: "evt-kyle",
        summary: "Joel <> Kyle Hoob",
        attendeeEmails: ["sing@crowdsourcechoir.com", "Hoob@Gonzaga.edu"],
      }),
    ],
    selfEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(
    priorOutreachSkipReason(meetingIndex, {
      opportunityId: "opp-gonzaga",
      organizationId: "org-gonzaga",
      contactId: "c-kyle",
      email: "hoob@gonzaga.edu",
    }),
    "meeting on calendar",
    "synced Google Calendar meeting with the contact email must block cold outreach"
  );

  // 4. Cancelled calendar events, self-email, and Bloom events must not falsely block unrelated prospects.
  const cleanIndex = buildPriorOutreachIndex({
    opportunities: [
      {
        id: "opp-fresh",
        organization_id: "org-fresh",
        last_outbound_at: null,
        last_inbound_at: null,
        gmail_thread_id: null,
        relationship_stage: null,
      },
    ],
    contacts: [
      {
        id: "c-fresh",
        organization_id: "org-fresh",
        email: "alex@freshsummit.org",
        normalized_email: "alex@freshsummit.org",
      },
    ],
    activities: [],
    approvedDrafts: [],
    calendarEvents: [
      calendarEvent({
        googleEventId: "evt-cancelled",
        status: "cancelled",
        attendeeEmails: ["alex@freshsummit.org"],
      }),
      calendarEvent({
        googleEventId: "evt-bloom",
        source: "bloom",
        attendeeEmails: ["alex@freshsummit.org"],
      }),
    ],
    selfEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(
    priorOutreachSkipReason(cleanIndex, {
      opportunityId: "opp-fresh",
      organizationId: "org-fresh",
      contactId: "c-fresh",
      email: "alex@freshsummit.org",
    }),
    null,
    "cancelled and bloom calendar events must not block fresh prospects"
  );

  // 5. Already-filed Gmail draft activity (`note` + `metadata.kind === "gmail_draft"`) blocks a second draft.
  const draftedIndex = buildPriorOutreachIndex({
    opportunities: [
      {
        id: "opp-2",
        organization_id: "org-drafted",
        last_outbound_at: null,
        last_inbound_at: null,
        gmail_thread_id: null,
        relationship_stage: null,
      },
    ],
    contacts: [
      {
        id: "c-drafted",
        organization_id: "org-drafted",
        email: "dana@summit.org",
        normalized_email: "dana@summit.org",
      },
    ],
    activities: [
      {
        opportunity_id: "opp-1",
        contact_id: "c-drafted",
        activity_type: "note",
        metadata: { kind: "gmail_draft", gmailDraftMessageId: "msg-1" },
      },
    ],
    approvedDrafts: [],
    calendarEvents: [],
    selfEmail: "sing@crowdsourcechoir.com",
  });
  assert.equal(
    priorOutreachSkipReason(draftedIndex, {
      opportunityId: "opp-2",
      organizationId: "org-drafted",
      contactId: "c-drafted",
      email: "dana@summit.org",
    }),
    "already contacted"
  );

  console.log("autosend dedup tests passed");
}

main();
