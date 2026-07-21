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
  bodyTemplate: string;
  status: "draft" | "approved" | "retired";
};

export type OutreachDraftStatus = "draft" | "qa_passed" | "qa_flagged" | "approved" | "approved_with_edits" | "rejected";

export type OutreachDraft = {
  id: string;
  opportunityId: string;
  contactId: string | null;
  pipelineRunId: string;
  templateId: string | null;
  aiSubject: string;
  aiBody: string;
  editedSubject: string | null;
  editedBody: string | null;
  qaFlags: { type: string; detail: string }[] | null;
  status: OutreachDraftStatus;
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

export type ApprovalQueueItem = {
  id: string;
  opportunityId: string;
  outreachDraftId: string | null;
  prospectScoreId: string | null;
  duplicateWarning: boolean;
  status: ApprovalQueueItemStatus;
  decisionNotes: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  deferredUntil: string | null;
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

/** Fully assembled view for one queue item — everything the review UI needs without extra navigation. */
export type QueueItemDetail = {
  queueItem: ApprovalQueueItem;
  opportunity: Opportunity;
  opportunityTypeLabel: string | null;
  organization: Organization;
  organizationTypeLabel: string | null;
  contact: Contact | null;
  score: ProspectScore | null;
  draft: OutreachDraft | null;
  findings: (ResearchFinding & { sourceUrl: string })[];
};
