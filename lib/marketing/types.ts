/** Marketing v1 — Octo-owned audience, segments, campaigns, and email sends. */

export type MarketingStatus = "subscribed" | "unsubscribed" | "cleaned" | "pending";

export type AcquisitionSource =
  | "mailchimp"
  | "squarespace"
  | "facebook"
  | "manual"
  | "import"
  | "song_garden"
  | "other";

export type MarketingPerson = {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  status: MarketingStatus;
  marketingConsent: boolean;
  consentAt: string | null;
  consentSource: string | null;
  acquisitionSource: AcquisitionSource;
  acquisitionDetail: Record<string, unknown> | null;
  tags: string[];
  mailchimpId: string | null;
  suppressedAt: string | null;
  bounceClass: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SegmentRuleField =
  | "status"
  | "marketingConsent"
  | "city"
  | "tag"
  | "acquisitionSource";

export type SegmentRuleOp = "eq" | "neq" | "contains" | "in";

export type SegmentRule = {
  field: SegmentRuleField;
  op: SegmentRuleOp;
  value: string | boolean | string[];
};

export type MarketingSegment = {
  id: string;
  name: string;
  description: string | null;
  /** All rules AND together for v1. */
  rules: SegmentRule[];
  createdAt: string;
  updatedAt: string;
};

export type CampaignStatus = "draft" | "active" | "archived";

export type MarketingCampaign = {
  id: string;
  name: string;
  purpose: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
};

export type EmailBlockType =
  | "hero"
  | "rich_text"
  | "image"
  | "cta"
  | "divider"
  | "footer"
  | "event";

export type EmailBlock = {
  id: string;
  type: EmailBlockType;
  /** Block-specific fields */
  props: Record<string, unknown>;
};

export type MarketingEmailStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled";

export type MarketingEmail = {
  id: string;
  campaignId: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  blocks: EmailBlock[];
  segmentId: string | null;
  status: MarketingEmailStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  stats: MarketingEmailStats;
  createdAt: string;
  updatedAt: string;
};

export type MarketingEmailStats = {
  queued: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
};

export type RecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "skipped";

export type MarketingRecipient = {
  id: string;
  emailId: string;
  personId: string;
  toEmail: string;
  providerMessageId: string | null;
  status: RecipientStatus;
  lastEventAt: string | null;
  createdAt: string;
};

export type MarketingDeliveryEvent = {
  id: string;
  recipientId: string | null;
  emailId: string | null;
  type: string;
  meta: Record<string, unknown> | null;
  occurredAt: string;
};

export type MarketingAcquisitionEvent = {
  id: string;
  personId: string;
  source: AcquisitionSource;
  externalId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export type MarketingSettings = {
  sendsEnabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  physicalAddress: string;
  companyName: string;
  ingestSecret: string | null;
};

export type MarketingStore = {
  version: 1;
  settings: MarketingSettings;
  people: MarketingPerson[];
  segments: MarketingSegment[];
  campaigns: MarketingCampaign[];
  emails: MarketingEmail[];
  recipients: MarketingRecipient[];
  deliveryEvents: MarketingDeliveryEvent[];
  acquisitionEvents: MarketingAcquisitionEvent[];
  updatedAt: string | null;
};

export const EMPTY_EMAIL_STATS: MarketingEmailStats = {
  queued: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  complained: 0,
  opened: 0,
  clicked: 0,
  unsubscribed: 0,
};

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  sendsEnabled: false,
  fromName: "Crowdsource Choir",
  fromEmail: "",
  replyTo: null,
  physicalAddress: "",
  companyName: "Crowdsource Choir",
  ingestSecret: null,
};

export function emptyMarketingStore(): MarketingStore {
  return {
    version: 1,
    settings: { ...DEFAULT_MARKETING_SETTINGS },
    people: [],
    segments: [],
    campaigns: [],
    emails: [],
    recipients: [],
    deliveryEvents: [],
    acquisitionEvents: [],
    updatedAt: null,
  };
}
