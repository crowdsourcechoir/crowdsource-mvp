// Shared domain types for the Sales Platform. Mirrors docs/sales-platform/database.md.
// DB rows are snake_case; everything here is camelCase, mapped in lib/sales/db/*.

export type PipelineStage =
  | "normalize"
  | "research"
  | "detect_opportunity"
  | "find_contact"
  | "enrich_contact"
  | "verify_contact"
  | "score"
  | "brief"
  | "draft"
  | "qa"
  | "queue"
  | "hubspot_sync";

export const PIPELINE_STAGES_ORDER: PipelineStage[] = [
  "normalize",
  "research",
  "detect_opportunity",
  "find_contact",
  "enrich_contact",
  "verify_contact",
  "score",
  "brief",
  "draft",
  "qa",
  "queue",
];

export type AgentRunStatus = "pending" | "running" | "succeeded" | "failed" | "retrying" | "skipped";
export type PipelineRunStatus = "pending" | "running" | "succeeded" | "failed" | "partially_failed";

export type IndustrySegment = {
  id: string;
  key: string;
  label: string;
};

export type OrganizationType = {
  id: string;
  key: string;
  label: string;
  industrySegmentId: string | null;
  isActive: boolean;
};

export type OpportunityType = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
};

export type Organization = {
  id: string;
  name: string;
  normalizedName: string;
  domain: string | null;
  organizationTypeId: string | null;
  /** Overrides the industry segment otherwise inherited transitively through organizationTypeId
   * (see organization_types.industry_segment_id). Null = inherit. See
   * lib/sales/db/lookups.ts#resolveIndustrySegmentIdForOrganization for the resolution order this
   * exists to support — e.g. distinguishing an education-focused association (ISACS) from a
   * healthcare or business association, which `organization_type = 'association'` alone can't do. */
  industrySegmentId: string | null;
  websiteUrl: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  estimatedSize: string | null;
  source: "manual" | "csv_import" | "ai_discovered";
  duplicateOfOrganizationId: string | null;
  isExistingClient: boolean;
  importMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  organizationId: string;
  fullName: string | null;
  roleTitle: string | null;
  roleCategory: string | null;
  /** Buyer-persona bucket derived from roleTitle — see lib/sales/outreach/persona.ts. Distinct from roleCategory (free-text CSV department). */
  outreachPersona: "executive_director" | "events_director" | "program_manager" | "board_member" | "conference_planner" | "other";
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  emailVerificationStatus: "unverified" | "valid_format" | "verified_deliverable" | "invalid" | "risky";
  linkedinUrl: string | null;
  source: "ai_discovered" | "manual" | "hubspot_import" | "csv_import";
  duplicateOfContactId: string | null;
  importMetadata: Record<string, unknown> | null;
  /** Phase 2 email enrichment (Apollo.io primary, Hunter.io fallback — see lib/sales/enrichment). Null until an attempt is made; set exactly once per contact to avoid re-spending paid API credits on retries. */
  enrichmentAttemptedAt: string | null;
  enrichmentProvider: "apollo" | "hunter" | null;
  enrichmentStatus: "found" | "not_found" | "error" | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityStatus =
  | "new"
  | "researching"
  | "awaiting_contact"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "deferred"
  | "needs_more_research"
  | "duplicate";

/** Post-approval funnel tracking — Joel's own mental model for what happens after an email is
 * launched, distinct from `status` above (which tracks the AI pipeline's own state, not the human
 * relationship). Null = not yet sent. `lost` is a terminal, non-funnel bucket, not a fourth funnel
 * stage — see docs/sales-platform/database.md. */
export type RelationshipStage = "awareness" | "interest" | "purchase" | "lost";

export type Opportunity = {
  id: string;
  organizationId: string;
  opportunityTypeId: string | null;
  title: string;
  eventOrInitiativeName: string | null;
  eventDateEstimate: string | null;
  eventDateConfidence: "confirmed" | "estimated" | "unknown" | null;
  description: string | null;
  status: OpportunityStatus;
  targetContactRoleHint: string | null;
  relationshipStage: RelationshipStage | null;
  stageUpdatedAt: string | null;
  /** Gmail thread for the outreach conversation (set on first successful send). */
  gmailThreadId: string | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  nextFollowUpAt: string | null;
  importMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineRun = {
  id: string;
  organizationId: string;
  trigger: "manual" | "cron" | "reprocess_request" | "csv_import";
  status: PipelineRunStatus;
  currentStage: PipelineStage | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalCostUsd: number | null;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  pipelineRunId: string;
  stage: PipelineStage;
  status: AgentRunStatus;
  attempt: number;
  maxAttempts: number;
  input: unknown;
  output: unknown;
  error: string | null;
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type ResearchSource = {
  id: string;
  pipelineRunId: string;
  url: string;
  title: string | null;
  fetchedAt: string;
  contentHash: string | null;
  rawExcerpt: string | null;
  retrievalStatus: "ok" | "blocked" | "error" | "paywalled" | "imported";
};

export type ResearchFinding = {
  id: string;
  pipelineRunId: string;
  organizationId: string;
  opportunityId: string | null;
  sourceId: string;
  claimType: string;
  claimText: string;
  claimValue: unknown;
  confidence: number | null;
  origin: "ai_research" | "human_provided";
  createdAt: string;
};

export const SCORE_COMPONENT_KEYS = [
  "audience_size",
  "event_relevance",
  "participatory_program_fit",
  "budget_likelihood",
  "timing",
  "geographic_fit",
  "decision_maker_access",
  "strategic_value",
  "repeat_business_potential",
  "research_confidence",
  "contact_quality",
] as const;

export type ScoreComponentKey = (typeof SCORE_COMPONENT_KEYS)[number];

export type ScoreComponent = {
  score: number; // 0-10
  weight: number; // 0-1, sums to 1 across all components
  rationale: string;
  findingIds: string[];
};

export type ProspectScore = {
  id: string;
  opportunityId: string;
  pipelineRunId: string;
  totalScore: number;
  componentScores: Record<ScoreComponentKey, ScoreComponent>;
  rationale: string;
  confidence: "low" | "medium" | "high";
  missingInformation: string[];
  model: string | null;
  createdAt: string;
};

export type OutreachTemplate = {
  id: string;
  name: string;
  opportunityTypeId: string | null;
  /** Optional targeting by the organization's resolved industry segment — see
   * lib/sales/db/outreach.ts#findApprovedTemplate for the exact matching/fallback order. Null =
   * not segment-targeted (e.g. the general-purpose default). */
  industrySegmentId: string | null;
  bodyTemplate: string;
  status: "draft" | "approved" | "retired";
};

export type OutreachDraftStatus = "draft" | "qa_passed" | "qa_flagged" | "approved" | "approved_with_edits" | "rejected";
export type OutreachDraftKind = "initial" | "nudge";

export type OutreachDraft = {
  id: string;
  opportunityId: string;
  contactId: string | null;
  pipelineRunId: string | null;
  templateId: string | null;
  kind: OutreachDraftKind;
  aiSubject: string;
  aiBody: string;
  editedSubject: string | null;
  editedBody: string | null;
  qaFlags: { type: string; detail: string }[] | null;
  status: OutreachDraftStatus;
  /** Soft 0–1 heuristic for queue sorting — still human-approved. */
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalQueueItemStatus =
  | "pending"
  | "approved"
  | "approved_with_edits"
  | "rejected"
  | "deferred"
  | "needs_more_research"
  | "duplicate";

export type ApprovalQueueItemKind = "initial" | "nudge";

export type ApprovalQueueItem = {
  id: string;
  opportunityId: string;
  outreachDraftId: string | null;
  prospectScoreId: string | null;
  kind: ApprovalQueueItemKind;
  duplicateWarning: boolean;
  status: ApprovalQueueItemStatus;
  decisionNotes: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  deferredUntil: string | null;
  createdAt: string;
};

export type OutreachActivityType =
  | "approved"
  | "sent"
  | "opened"
  | "replied"
  | "bounced"
  | "follow_up_due"
  | "note"
  | "send_failed";

export type OutreachActivity = {
  id: string;
  opportunityId: string;
  contactId: string | null;
  activityType: OutreachActivityType;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
};

export type GmailConnection = {
  id: string;
  ownerKey: string;
  email: string;
  refreshTokenEncrypted: string;
  historyId: string | null;
  scopes: string[];
  /** Operator toggle. Reconnect leaves this false until Resume sending. */
  sendsEnabled: boolean;
  connectedAt: string;
  updatedAt: string;
};

export type OutreachFeedbackDecision = "approved_with_edits" | "rejected";

export type OutreachFeedback = {
  id: string;
  opportunityId: string;
  outreachDraftId: string | null;
  contactId: string | null;
  opportunityTypeId: string | null;
  industrySegmentId: string | null;
  outreachPersona: string | null;
  decision: OutreachFeedbackDecision;
  originalSubject: string;
  originalBody: string;
  editedSubject: string | null;
  editedBody: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

/** Stage 0: nightly/manual discovery of brand-new candidate organizations not yet in `organizations`. Sibling of `pipeline_runs`, not a child — discovery happens before any organization row exists. */
export type DiscoveryRun = {
  id: string;
  trigger: "manual" | "cron";
  status: "running" | "succeeded" | "failed";
  provider: "tavily" | "serper" | null;
  queries: { query: string; resultsCount: number; candidatesExtracted: number }[];
  candidatesFound: number;
  candidatesNew: number;
  candidatesDuplicate: number;
  createdOrganizationIds: string[];
  model: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  costUsd: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};

/** The "new leads in my inbox every morning" email — one row per send attempt, tracks the cutoff
 * timestamp for "new since last digest" and gives the send an audit trail like every other run
 * type in this system. Sibling of discovery_runs/pipeline_runs, not a child of either. */
export type DigestRun = {
  id: string;
  trigger: "manual" | "cron";
  status: "running" | "succeeded" | "failed" | "skipped_no_provider";
  itemCount: number;
  recipient: string | null;
  providerMessageId: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
};

/** Internal salesperson brief from the pipeline brief stage — the 15-second gut-check read on the queue. */
export type OpportunityBrief = {
  summary: string;
  recommendedAngle: string;
  risks: string[];
};

/** Fully assembled view for one queue item — everything the review UI needs without extra navigation. */
export type QueueItemDetail = {
  queueItem: ApprovalQueueItem;
  opportunity: Opportunity;
  opportunityTypeLabel: string | null;
  organization: Organization;
  organizationTypeLabel: string | null;
  contact: Contact | null;
  /** All org contacts with usable emails — for the queue contact picker. */
  contacts: Contact[];
  /** Initial drafts keyed to those contacts (may be fewer than contacts until generated). */
  contactDrafts: OutreachDraft[];
  score: ProspectScore | null;
  /** Latest succeeded brief-stage output for this opportunity, if any. */
  brief: OpportunityBrief | null;
  draft: OutreachDraft | null;
  findings: (ResearchFinding & { sourceUrl: string })[];
};

/** Opportunity detail page (funnel / deep link) — QueueItemDetail plus CRM context. */
export type OpportunityPageDetail = QueueItemDetail & {
  contacts: Contact[];
  emailSentAt: string | null;
  emailRepliedAt: string | null;
  /** Distinct useful links: org site + conference/event research pages. */
  links: { url: string; label: string; kind: "organization" | "conference" | "research" }[];
};

/** One card's worth of data for /admin/sales/funnel — deliberately reuses the same
 * queue-item→draft→contact join shape as QueueItemDetail (via assembleFunnelItems in
 * lib/sales/db/assemble.ts) rather than inventing a new one. */
export type FunnelItemDetail = {
  opportunity: Opportunity;
  organization: Organization;
  contact: Contact | null;
  draft: OutreachDraft | null;
  /** approval_queue_items.decided_at — "when this was approved/launched," used as the "days
   * since" anchor if stageUpdatedAt is ever unexpectedly null. */
  approvedAt: string | null;
  /** True when nextFollowUpAt is due and there's been no inbound since last outbound. */
  needsNudge: boolean;
};
