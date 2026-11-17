export type AutoSendSlotStatus = "queued" | "sending" | "sent" | "failed" | "skipped";

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
  /** Pacific calendar day the send is assigned to, YYYY-MM-DD. */
  day: string;
  scheduledAt: string;
  status: AutoSendSlotStatus;
  statusSince: string | null;
  sentAt: string | null;
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
};
