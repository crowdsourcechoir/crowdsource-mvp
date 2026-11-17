import type { AutoSendLane } from "./policy";

export type AutoSendSlotStatus = "queued" | "sending" | "sent" | "drafted" | "failed" | "skipped";

export type AutoSendLaneCounts = Record<AutoSendLane, number>;

export type AutoSendSlot = {
  queueItemId: string;
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  contactName: string | null;
  contactEmail: string;
  subject: string;
  eventTitle: string;
  eventDate: string;
  score: number;
  lane: AutoSendLane;
  /** Pacific calendar day the send is assigned to, YYYY-MM-DD. */
  day: string;
  scheduledAt: string;
  status: AutoSendSlotStatus;
  statusSince: string | null;
  /** When the slot finished: a real send, or the moment a Gmail draft was created. */
  sentAt: string | null;
  /** Link to the unsent Gmail draft. Null for older slots that were sent outright. */
  draftUrl: string | null;
  error: string | null;
  attempts: number;
};

export type AutoSendReportMark = {
  day: string;
  sentAt: string;
};

export type AutoSendState = {
  enabled: boolean;
  updatedAt: string | null;
  slots: AutoSendSlot[];
  reports: AutoSendReportMark[];
  /** Verified leads that clear the bar, counted by lane. Null until the plan has been refreshed. */
  ready: AutoSendLaneCounts | null;
};

export type AutoSendCandidate = {
  queueItemId: string;
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  contactName: string | null;
  contactEmail: string;
  subject: string;
  eventTitle: string;
  eventDate: string;
  score: number;
  lane: AutoSendLane;
};
