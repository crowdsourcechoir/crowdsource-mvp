import { refreshAutoSendPlan } from "@/lib/sales/autosend/tick";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  clearFailedEnrichmentAttempts,
  listContactsForOrganization,
} from "@/lib/sales/db/contacts";
import {
  getOpportunity,
  listOpportunitiesForOrganization,
  updateOpportunityStatus,
  updateOpportunityTouchTimestamps,
} from "@/lib/sales/db/opportunities";
import { getOrganization, updateOrganization } from "@/lib/sales/db/organizations";
import { listDraftsForOpportunity } from "@/lib/sales/db/outreach";
import { createOrUpdateQueueItem } from "@/lib/sales/db/queue";
import {
  extractDomain,
  isGenericMailboxEmail,
  isPlausibleEmail,
  isSendableContact,
  looksLikePersonName,
} from "@/lib/sales/dedupe";
import { getHunterAccountCredits } from "@/lib/sales/enrichment/hunter-account";
import {
  hunterContactSlotsRemaining,
  hunterCreditBudgetRemaining,
} from "@/lib/sales/enrichment/hunter-org-budget";
import {
  enrichOrganizationWithHunter,
  isNamedPersonalSendableContact,
  isSharedOrPlatformDomain,
  organizationHasOnlyWeakContacts,
  type NamedPersonHint,
} from "@/lib/sales/enrichment/hunter-org-enrich";
import { followUpPresetIso } from "@/lib/sales/follow-up/calendar";
import { readSalesInitiative } from "@/lib/sales/initiatives";
import { drainAnthemPricing } from "@/lib/sales/pricing/evaluate";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import { isHeldFromAutoPipeline } from "@/lib/sales/prospecting/hold-auto-pipeline";
import { seedArtsWaWfea } from "@/lib/sales/seed/artswa-wfea";
import { ensureContactDrafts, enqueueOrgManually } from "@/lib/sales/seed/enqueue-manual";
import { seedEeFundraisingPartnership } from "@/lib/sales/seed/seed-ee-fundraising-partnership";
import { seedElxAnnualCongress } from "@/lib/sales/seed/seed-elx-annual-congress";
import { seedEudemoniaComparables } from "@/lib/sales/seed/seed-eudemonia-comparables";
import { seedKey2027Prospects } from "@/lib/sales/seed/seed-key-2027-prospects";
import { wfeaOpportunityTypeKey } from "@/lib/sales/seed/wfea-members";
import type { Contact } from "@/lib/sales/types";

export const HUNTER_SWEEP_FLAG = "hunterBackOnlineSweepV1";
export const HUNTER_SWEEP_CREDIT_RESERVE = 100;
const DEFAULT_BATCH_ORGS = 20;
const DEFAULT_BUDGET_MS = 180_000;
const LEASE_MS = 4 * 60_000;
const RECENT_DAYS_MS = 14 * 86_400_000;

const SCHOOL_AUCTION_RE =
  /\b(schools?|academ(?:y|ies)|ptsa|pta|preparatory|elementary|high school|middle school|parish)\b/i;

const RECENT_SEED_FLAGS = [
  "key2027ProspectsSeeded",
  "elxCongressSeeded",
  "eudemoniaComparablesSeeded",
  "artswaWfeaSeeded",
  "eeFundraisingPartnershipSeeded",
  "experientialAgenciesSeeded",
  "entertainmentBookingAgenciesSeeded",
  "bookingAgentsSeeded",
  "elevateVibeCreateSeeded",
  "amplify2027Seeded",
  "resendForwardSeeded",
  "whxContactsSeeded",
] as const;

const KNOWN_LEADER_HINTS: Record<string, NamedPersonHint[]> = {
  "Event Leaders Exchange": [
    { fullName: "Nicola Kastner", roleTitle: "Chief Executive Officer", roleCategory: "executive" },
    { fullName: "Hannah Elston", roleTitle: "Partnerships Lead", roleCategory: "partnerships" },
    { fullName: "Mark Brewster", roleTitle: "Co-Founder", roleCategory: "executive" },
    { fullName: "David Kliman", roleTitle: "Co-Founder", roleCategory: "executive" },
  ],
  "Eudēmonia Summit": [
    { fullName: "Jonnie Halstead", roleTitle: "VP of Events", roleCategory: "events" },
    { fullName: "Karina Mackenzie", roleTitle: "VP of Programming", roleCategory: "events" },
  ],
  "The Longevity Show": [
    { fullName: "Daniel Burridge", roleTitle: "Event Director", roleCategory: "events" },
    { fullName: "Carolyn Dawson", roleTitle: "Co-Founder", roleCategory: "executive" },
    { fullName: "Phil Newman", roleTitle: "Co-Founder", roleCategory: "executive" },
  ],
  "Health Optimisation Summit": [
    { fullName: "Tim Gray", roleTitle: "Founder", roleCategory: "executive" },
  ],
};

export type SweepTier = "new_lead" | "weak_generic_queue" | "awaiting_or_uncontacted";

type OrgRow = {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  organization_type_id: string | null;
  is_existing_client: boolean | null;
  import_metadata: Record<string, unknown> | null;
  created_at: string;
};

type ContactRow = {
  id: string;
  organization_id: string;
  full_name: string | null;
  role_title: string | null;
  role_category: string | null;
  email: string | null;
  normalized_email: string | null;
  email_verification_status: string | null;
  duplicate_of_contact_id: string | null;
  enrichment_attempted_at: string | null;
  enrichment_status: string | null;
  import_metadata: Record<string, unknown> | null;
};

type OppRow = {
  id: string;
  organization_id: string;
  opportunity_type_id: string | null;
  title: string;
  event_or_initiative_name: string | null;
  status: string;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  gmail_thread_id: string | null;
  import_metadata: Record<string, unknown> | null;
};

type QueueRow = {
  id: string;
  opportunity_id: string;
  outreach_draft_id: string | null;
  prospect_score_id: string | null;
  kind: string | null;
  status: string | null;
};

type DraftRow = {
  id: string;
  opportunity_id: string;
  contact_id: string | null;
  status: string;
  edited_subject: string | null;
  edited_body: string | null;
};

type ScoreRow = {
  id: string;
  opportunity_id: string;
  total_score: number;
  created_at: string;
};

async function fetchAllPaged<T>(
  table: string,
  columns: string,
  pageSize = 1000
): Promise<T[]> {
  const db = requireSupabaseAdmin();
  const out: T[] = [];
  for (let from = 0; from < 12_000; from += pageSize) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function liteContactToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    roleTitle: row.role_title,
    roleCategory: row.role_category,
    outreachPersona: "other",
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: null,
    emailVerificationStatus:
      (row.email_verification_status as Contact["emailVerificationStatus"]) ?? "unverified",
    linkedinUrl: null,
    source: "manual",
    duplicateOfContactId: row.duplicate_of_contact_id,
    importMetadata: row.import_metadata,
    enrichmentAttemptedAt: row.enrichment_attempted_at,
    enrichmentProvider: null,
    enrichmentStatus: (row.enrichment_status as Contact["enrichmentStatus"]) ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

function isRecentOrSeededNewLead(org: OrgRow, nowMs: number): boolean {
  const meta = org.import_metadata ?? {};
  for (const flag of RECENT_SEED_FLAGS) {
    if (meta[flag] === true) return true;
  }
  const createdMs = Date.parse(org.created_at);
  if (Number.isFinite(createdMs) && nowMs - createdMs <= RECENT_DAYS_MS) return true;
  const queuedAt = typeof meta.operatorQueuedAt === "string" ? Date.parse(meta.operatorQueuedAt) : NaN;
  if (Number.isFinite(queuedAt) && nowMs - queuedAt <= RECENT_DAYS_MS) return true;
  return false;
}

function hasUnverifiedNamedPersonal(contacts: Contact[]): boolean {
  return contacts.some(
    (c) =>
      !c.duplicateOfContactId &&
      looksLikePersonName(c.fullName) &&
      c.email &&
      isPlausibleEmail(c.email) &&
      !isGenericMailboxEmail(c.email) &&
      (c.emailVerificationStatus === "valid_format" || c.emailVerificationStatus === "unverified") &&
      !(c.importMetadata && typeof c.importMetadata.hunterVerifier === "string" && c.importMetadata.hunterVerifier !== "error")
  );
}

function hasNamedMissingEmail(contacts: Contact[]): boolean {
  return contacts.some(
    (c) =>
      !c.duplicateOfContactId &&
      looksLikePersonName(c.fullName) &&
      !c.email &&
      (!c.enrichmentAttemptedAt || c.enrichmentStatus === "error")
  );
}

type SweepCandidate = {
  org: OrgRow;
  tier: SweepTier;
  priority: number;
  needsPromoteOnly: boolean;
};

async function collectSweepCandidates(options?: { force?: boolean }): Promise<{
  candidates: SweepCandidate[];
  tierCounts: Record<SweepTier, number>;
  alreadySweptCount: number;
  oppTypeKeyById: Map<string, string>;
  orgTypeKeyById: Map<string, string>;
  domainCounts: Map<string, number>;
}> {
  const force = Boolean(options?.force);
  const nowMs = Date.now();
  const db = requireSupabaseAdmin();

  // Sequential paged reads keep PostgREST connection concurrency at 1 so cron passes
  // never starve interactive /admin/sales requests on small Supabase instances.
  const orgs = await fetchAllPaged<OrgRow>(
    "organizations",
    "id, name, domain, website_url, organization_type_id, is_existing_client, import_metadata, created_at"
  );
  const contactRows = await fetchAllPaged<ContactRow>(
    "contacts",
    "id, organization_id, full_name, role_title, role_category, email, normalized_email, email_verification_status, duplicate_of_contact_id, enrichment_attempted_at, enrichment_status, import_metadata"
  );
  const oppRows = await fetchAllPaged<OppRow>(
    "opportunities",
    "id, organization_id, opportunity_type_id, title, event_or_initiative_name, status, last_outbound_at, last_inbound_at, gmail_thread_id, import_metadata"
  );
  const queueRows = await fetchAllPaged<QueueRow>(
    "approval_queue_items",
    "id, opportunity_id, outreach_draft_id, prospect_score_id, kind, status"
  );
  const draftRows = await fetchAllPaged<DraftRow>(
    "outreach_drafts",
    "id, opportunity_id, contact_id, status, edited_subject, edited_body"
  );
  const scoreRows = await fetchAllPaged<ScoreRow>(
    "prospect_scores",
    "id, opportunity_id, total_score, created_at"
  );
  const [oppTypeRes, orgTypeRes] = await Promise.all([
    db.from("opportunity_types").select("id, key"),
    db.from("organization_types").select("id, key"),
  ]);

  const oppTypeKeyById = new Map(
    ((oppTypeRes.data ?? []) as Array<{ id: string; key: string }>).map((r) => [r.id, r.key])
  );
  const orgTypeKeyById = new Map(
    ((orgTypeRes.data ?? []) as Array<{ id: string; key: string }>).map((r) => [r.id, r.key])
  );

  const contactsByOrg = new Map<string, Contact[]>();
  const contactById = new Map<string, Contact>();
  for (const row of contactRows) {
    const c = liteContactToContact(row);
    contactById.set(c.id, c);
    const list = contactsByOrg.get(c.organizationId) ?? [];
    list.push(c);
    contactsByOrg.set(c.organizationId, list);
  }

  const oppsByOrg = new Map<string, OppRow[]>();
  for (const opp of oppRows) {
    const list = oppsByOrg.get(opp.organization_id) ?? [];
    list.push(opp);
    oppsByOrg.set(opp.organization_id, list);
  }

  const pendingQueueByOpp = new Map<string, QueueRow>();
  for (const q of queueRows) {
    if (q.status === "pending" && (q.kind === "initial" || q.kind == null)) {
      pendingQueueByOpp.set(q.opportunity_id, q);
    }
  }

  const draftById = new Map(draftRows.map((d) => [d.id, d]));

  const bestScoreByOpp = new Map<string, number>();
  for (const s of scoreRows) {
    const prev = bestScoreByOpp.get(s.opportunity_id) ?? -1;
    if (Number(s.total_score) > prev) bestScoreByOpp.set(s.opportunity_id, Number(s.total_score));
  }

  const domainCounts = new Map<string, number>();
  for (const org of orgs) {
    const d = extractDomain(org.website_url ?? org.domain);
    if (d) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }

  const candidates: SweepCandidate[] = [];
  const tierCounts: Record<SweepTier, number> = {
    new_lead: 0,
    weak_generic_queue: 0,
    awaiting_or_uncontacted: 0,
  };
  let alreadySweptCount = 0;

  for (const org of orgs) {
    const meta = org.import_metadata ?? {};
    if (meta[HUNTER_SWEEP_FLAG] === true && !force) {
      alreadySweptCount += 1;
      continue;
    }
    if (org.is_existing_client || isDoNotProspect(meta)) continue;

    const leaseUntil = typeof meta.hunterSweepLeaseUntil === "string" ? Date.parse(meta.hunterSweepLeaseUntil) : NaN;
    if (Number.isFinite(leaseUntil) && leaseUntil > nowMs && !force) continue;

    const domain = extractDomain(org.website_url ?? org.domain);
    if (!domain) continue;

    const contacts = contactsByOrg.get(org.id) ?? [];
    const opps = oppsByOrg.get(org.id) ?? [];
    const weakOnly = organizationHasOnlyWeakContacts(contacts);
    const unverifiedNamed = hasUnverifiedNamedPersonal(contacts);
    const missingNamed = hasNamedMissingEmail(contacts);
    const hints = KNOWN_LEADER_HINTS[org.name] ?? [];
    const hasMissingHint = hints.some(
      (h) => !contacts.some((c) => (c.fullName ?? "").trim().toLowerCase() === h.fullName.toLowerCase())
    );

    // Check if any pending queue item for this org is currently addressed to a weak / generic inbox contact
    let hasWeakQueueDraft = false;
    let maxOppScore = -1;
    let maxSuggestedFee = 0;
    for (const opp of opps) {
      const sc = bestScoreByOpp.get(opp.id) ?? -1;
      if (sc > maxOppScore) maxOppScore = sc;
      const fee =
        typeof opp.import_metadata?.suggestedAnthemFee === "number"
          ? opp.import_metadata.suggestedAnthemFee
          : typeof opp.import_metadata?.potentialAmount === "number"
            ? opp.import_metadata.potentialAmount
            : 0;
      if (fee > maxSuggestedFee) maxSuggestedFee = fee;

      if (opp.last_outbound_at || opp.last_inbound_at || opp.gmail_thread_id) continue;
      const q = pendingQueueByOpp.get(opp.id);
      if (!q) continue;
      const draft = q.outreach_draft_id ? draftById.get(q.outreach_draft_id) : undefined;
      const draftContact = draft?.contact_id ? contactById.get(draft.contact_id) : undefined;
      if (!isNamedPersonalSendableContact(draftContact)) {
        hasWeakQueueDraft = true;
      }
    }

    const orgHasHunterBudget =
      hunterCreditBudgetRemaining({
        id: org.id,
        name: org.name,
        normalizedName: "",
        domain: org.domain,
        organizationTypeId: org.organization_type_id,
        industrySegmentId: null,
        websiteUrl: org.website_url,
        locationCity: null,
        locationRegion: null,
        locationCountry: null,
        estimatedSize: null,
        source: "manual",
        duplicateOfOrganizationId: null,
        isExistingClient: false,
        importMetadata: meta,
        createdAt: org.created_at,
        updatedAt: org.created_at,
      }) >= 0.5;

    const canPromoteWithoutHunter = !weakOnly && hasWeakQueueDraft;
    if (!orgHasHunterBudget && !canPromoteWithoutHunter) continue;

    // Shared domains cannot run Domain Search, so only include them if they have named contacts to verify/find or promote
    const sharedDomain = isSharedOrPlatformDomain(domain) || (domainCounts.get(domain) ?? 0) > 1;
    if (sharedDomain && !unverifiedNamed && !missingNamed && !hasMissingHint && !canPromoteWithoutHunter) {
      continue;
    }

    const hasPendingQueue = opps.some((o) => pendingQueueByOpp.has(o.id));
    if (isHeldFromAutoPipeline(meta) && !hasPendingQueue) {
      continue;
    }

    const isSchool = SCHOOL_AUCTION_RE.test(org.name) || opps.some((o) => SCHOOL_AUCTION_RE.test(o.title));
    const feeBoost = maxSuggestedFee >= 15_000 ? 200 : isSchool ? -50 : 50;

    if (isRecentOrSeededNewLead(org, nowMs)) {
      if (weakOnly || unverifiedNamed || missingNamed || hasMissingHint || hasWeakQueueDraft) {
        const seedPriority =
          meta.elxCongressSeeded || meta.eudemoniaComparablesSeeded || meta.key2027ProspectsSeeded
            ? 1000
            : meta.artswaWfeaSeeded || meta.eeFundraisingPartnershipSeeded
              ? 950
              : hasPendingQueue
                ? 850
                : 750;
        candidates.push({
          org,
          tier: "new_lead",
          priority: seedPriority + feeBoost + (weakOnly ? 80 : 0) + Math.max(0, maxOppScore),
          needsPromoteOnly: canPromoteWithoutHunter && !unverifiedNamed && !missingNamed && !hasMissingHint,
        });
        tierCounts.new_lead += 1;
        continue;
      }
    }

    if (hasWeakQueueDraft || (weakOnly && opps.some((o) => pendingQueueByOpp.has(o.id)))) {
      if (weakOnly && hunterContactSlotsRemaining(contacts) <= 0) continue;
      candidates.push({
        org,
        tier: "weak_generic_queue",
        priority: 500 + feeBoost + Math.max(0, maxOppScore),
        needsPromoteOnly: canPromoteWithoutHunter,
      });
      tierCounts.weak_generic_queue += 1;
      continue;
    }

    if (!isHeldFromAutoPipeline(meta) && weakOnly && hunterContactSlotsRemaining(contacts) > 0) {
      const hasAwaitingOpp = opps.some(
        (o) => o.status === "awaiting_contact" || o.status === "new" || o.status === "researching"
      );
      const isWfeaTarget = meta.wfeaSalesTarget === true;
      const isKeynoteSeed = meta.seededNationalKeynoteTarget === true;
      if (hasAwaitingOpp || isWfeaTarget || isKeynoteSeed) {
        candidates.push({
          org,
          tier: "awaiting_or_uncontacted",
          priority:
            200 +
            (maxOppScore >= 70 ? 150 : maxOppScore >= 45 ? 80 : 0) +
            (isKeynoteSeed ? 90 : 0) +
            Math.max(0, maxOppScore),
          needsPromoteOnly: false,
        });
        tierCounts.awaiting_or_uncontacted += 1;
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  return {
    candidates,
    tierCounts,
    alreadySweptCount,
    oppTypeKeyById,
    orgTypeKeyById,
    domainCounts,
  };
}

export type HunterSweepBatchResult = {
  ok: boolean;
  done: boolean;
  stoppedReason: string | null;
  seedsEnsured: Record<string, unknown> | null;
  enrichmentErrorsCleared: number;
  batchAttempted: number;
  contactsAdded: number;
  contactsVerified: number;
  bouncesDetected: number;
  upgradedFromGeneric: number;
  queueDraftsPromoted: number;
  newlyEnqueued: number;
  remainingEligible: number;
  remainingByTier: Record<SweepTier, number>;
  credits: {
    beforeUsed: number | null;
    afterUsed: number | null;
    batchDelta: number | null;
    available: number | null;
    remaining: number | null;
  };
  processedOrgs: Array<{
    name: string;
    domain: string | null;
    tier: SweepTier;
    added: number;
    verified: number;
    upgradedFromGeneric: number;
    queuePromoted: number;
    enqueued: number;
    creditsDelta: number;
  }>;
  errors: Array<{ name: string; error: string }>;
};

export async function runHunterLeadSweep(options?: {
  maxOrgs?: number;
  budgetMs?: number;
  force?: boolean;
  ensureRecentSeeds?: boolean;
}): Promise<HunterSweepBatchResult> {
  const startedAt = Date.now();
  const maxOrgs = Math.max(1, Math.min(50, options?.maxOrgs ?? DEFAULT_BATCH_ORGS));
  const budgetMs = Math.max(20_000, options?.budgetMs ?? DEFAULT_BUDGET_MS);
  const force = Boolean(options?.force);

  let seedsEnsured: Record<string, unknown> | null = null;
  let enrichmentErrorsCleared = 0;

  if (options?.ensureRecentSeeds) {
    const [elx, eudemonia, key2027, artswa, ee] = await Promise.all([
      seedElxAnnualCongress().catch((e) => ({ error: String(e) })),
      seedEudemoniaComparables().catch((e) => ({ error: String(e) })),
      seedKey2027Prospects().catch((e) => ({ error: String(e) })),
      seedArtsWaWfea().catch((e) => ({ error: String(e) })),
      seedEeFundraisingPartnership().catch((e) => ({ error: String(e) })),
    ]);
    seedsEnsured = {
      elx: "alreadySeeded" in elx ? { alreadySeeded: elx.alreadySeeded, created: elx.created } : elx,
      eudemonia: "enqueued" in eudemonia ? { enqueued: eudemonia.enqueued, skipped: eudemonia.skippedAlreadySeeded } : eudemonia,
      key2027: "enqueued" in key2027 ? { enqueued: key2027.enqueued, skipped: key2027.skippedAlreadySeeded } : key2027,
      artswa: "enqueued" in artswa ? { enqueued: artswa.enqueued, skipped: artswa.skippedAlreadySeeded } : artswa,
      ee: "enqueued" in ee ? { enqueued: ee.enqueued } : ee,
    };
    enrichmentErrorsCleared = await clearFailedEnrichmentAttempts().catch(() => 0);
  }

  const before = await getHunterAccountCredits();
  if (!before.ok) {
    return {
      ok: false,
      done: false,
      stoppedReason: before.error ?? "hunter_unavailable",
      seedsEnsured,
      enrichmentErrorsCleared,
      batchAttempted: 0,
      contactsAdded: 0,
      contactsVerified: 0,
      bouncesDetected: 0,
      upgradedFromGeneric: 0,
      queueDraftsPromoted: 0,
      newlyEnqueued: 0,
      remainingEligible: 0,
      remainingByTier: { new_lead: 0, weak_generic_queue: 0, awaiting_or_uncontacted: 0 },
      credits: {
        beforeUsed: null,
        afterUsed: null,
        batchDelta: null,
        available: null,
        remaining: null,
      },
      processedOrgs: [],
      errors: [],
    };
  }

  const startRemaining =
    before.creditsAvailable != null && before.creditsUsed != null
      ? before.creditsAvailable - before.creditsUsed
      : null;

  const { candidates, tierCounts, oppTypeKeyById, orgTypeKeyById, domainCounts } =
    await collectSweepCandidates({ force });

  if (startRemaining != null && startRemaining < HUNTER_SWEEP_CREDIT_RESERVE) {
    return {
      ok: true,
      done: true,
      stoppedReason: `credit_reserve_reached (${startRemaining} remaining)`,
      seedsEnsured,
      enrichmentErrorsCleared,
      batchAttempted: 0,
      contactsAdded: 0,
      contactsVerified: 0,
      bouncesDetected: 0,
      upgradedFromGeneric: 0,
      queueDraftsPromoted: 0,
      newlyEnqueued: 0,
      remainingEligible: candidates.length,
      remainingByTier: tierCounts,
      credits: {
        beforeUsed: before.creditsUsed,
        afterUsed: before.creditsUsed,
        batchDelta: 0,
        available: before.creditsAvailable,
        remaining: startRemaining,
      },
      processedOrgs: [],
      errors: [],
    };
  }

  const db = requireSupabaseAdmin();
  let batchAttempted = 0;
  let contactsAdded = 0;
  let contactsVerified = 0;
  let bouncesDetected = 0;
  let upgradedFromGeneric = 0;
  let queueDraftsPromoted = 0;
  let newlyEnqueued = 0;
  let stoppedReason: string | null = null;
  const processedOrgs: HunterSweepBatchResult["processedOrgs"] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const candidate of candidates) {
    if (batchAttempted >= maxOrgs) {
      stoppedReason = "batch_limit_reached";
      break;
    }
    if (Date.now() - startedAt >= budgetMs) {
      stoppedReason = "time_budget_reached";
      break;
    }

    const liveAcc = await getHunterAccountCredits();
    if (
      liveAcc.ok &&
      liveAcc.creditsAvailable != null &&
      liveAcc.creditsUsed != null &&
      liveAcc.creditsAvailable - liveAcc.creditsUsed < HUNTER_SWEEP_CREDIT_RESERVE
    ) {
      stoppedReason = "credit_reserve_reached";
      break;
    }

    try {
      const freshOrg = await getOrganization(candidate.org.id);
      if (!freshOrg) continue;
      const freshMeta = (freshOrg.importMetadata ?? {}) as Record<string, unknown>;
      if (freshMeta[HUNTER_SWEEP_FLAG] === true && !force) continue;
      const lease =
        typeof freshMeta.hunterSweepLeaseUntil === "string"
          ? Date.parse(freshMeta.hunterSweepLeaseUntil)
          : NaN;
      if (Number.isFinite(lease) && lease > Date.now() && !force) continue;

      // Claim lease so overlapping cron invocations skip this org.
      await updateOrganization(freshOrg.id, {
        importMetadata: {
          ...freshMeta,
          hunterSweepLeaseUntil: new Date(Date.now() + LEASE_MS).toISOString(),
        },
      });

      batchAttempted += 1;
      const opps = await listOpportunitiesForOrganization(freshOrg.id);
      const firstOppTypeKey = opps[0]?.opportunityTypeId
        ? oppTypeKeyById.get(opps[0].opportunityTypeId) ?? null
        : null;
      const domain = extractDomain(freshOrg.websiteUrl ?? freshOrg.domain);
      const multiOrgSameDomain = Boolean(domain && (domainCounts.get(domain) ?? 0) > 1);

      let orgAdded = 0;
      let orgVerified = 0;
      let orgUpgraded = 0;
      let orgCreditsDelta = 0;

      if (!candidate.needsPromoteOnly) {
        const enrichRes = await enrichOrganizationWithHunter(freshOrg, {
          verifyExistingNamed: candidate.tier === "new_lead" || candidate.tier === "weak_generic_queue",
          skipDomainSearch: multiOrgSameDomain,
          topUpSingleNamedWithGeneric:
            candidate.tier === "new_lead" &&
            Boolean(
              freshMeta.eudemoniaComparablesSeeded ||
                freshMeta.elxCongressSeeded ||
                freshMeta.experientialAgenciesSeeded ||
                freshMeta.entertainmentBookingAgenciesSeeded
            ),
          salesInitiative: readSalesInitiative(freshOrg.importMetadata),
          opportunityTypeKey: firstOppTypeKey,
          namedPeopleHints: KNOWN_LEADER_HINTS[freshOrg.name],
        });

        orgAdded = enrichRes.finderFound + enrichRes.domainSearchAdded;
        orgVerified = enrichRes.verifiedExistingCount;
        orgUpgraded = enrichRes.upgradedFromGenericCount;
        orgCreditsDelta = enrichRes.creditsDelta;
        contactsAdded += orgAdded;
        contactsVerified += orgVerified;
        bouncesDetected += enrichRes.bouncedExistingCount;
        upgradedFromGeneric += orgUpgraded;
      }

      // Reload org (to preserve hunterCreditsSpent) and contacts, then sync drafts + queue items.
      const updatedOrg = (await getOrganization(freshOrg.id)) ?? freshOrg;
      const contacts = await listContactsForOrganization(freshOrg.id);
      const hasNamedSendable = contacts.some(isNamedPersonalSendableContact);
      const hasAnySendable = contacts.some(isSendableContact);

      let orgPromoted = 0;
      let orgEnqueued = 0;

      if (opps.length > 0 && hasAnySendable) {
        for (const opp of opps) {
          if (opp.lastOutboundAt || opp.lastInboundAt || opp.gmailThreadId) continue;
          if (
            opp.status === "approved" ||
            opp.status === "rejected" ||
            opp.status === "deferred" ||
            opp.status === "duplicate"
          ) {
            continue;
          }

          const oppTypeKey = opp.opportunityTypeId
            ? oppTypeKeyById.get(opp.opportunityTypeId) ?? null
            : null;
          const ensured = await ensureContactDrafts({
            organization: updatedOrg,
            opportunityId: opp.id,
            opportunityTypeKey: oppTypeKey,
            eventName: opp.eventOrInitiativeName,
          });

          const { data: qRows } = await db
            .from("approval_queue_items")
            .select("id, outreach_draft_id, prospect_score_id, status, kind")
            .eq("opportunity_id", opp.id)
            .or("kind.eq.initial,kind.is.null")
            .order("created_at", { ascending: false })
            .limit(1);
          const qItem = qRows?.[0] as
            | {
                id: string;
                outreach_draft_id: string | null;
                prospect_score_id: string | null;
                status: string;
              }
            | undefined;

          if (qItem && qItem.status === "pending" && isNamedPersonalSendableContact(ensured.primaryContact)) {
            const oppDrafts = await listDraftsForOpportunity(opp.id);
            const currentDraft = oppDrafts.find((d) => d.id === qItem.outreach_draft_id);
            const currentContact = contacts.find((c) => c.id === currentDraft?.contactId);
            const currentIsWeak = !isNamedPersonalSendableContact(currentContact);
            const hasNoHumanEdits =
              currentDraft?.editedSubject == null && currentDraft?.editedBody == null;
            const targetIsOpen =
              ensured.primaryDraft.status === "draft" || ensured.primaryDraft.status === "qa_flagged";

            if (currentIsWeak && hasNoHumanEdits && targetIsOpen && qItem.outreach_draft_id !== ensured.primaryDraft.id) {
              await createOrUpdateQueueItem({
                opportunityId: opp.id,
                outreachDraftId: ensured.primaryDraft.id,
                prospectScoreId: qItem.prospect_score_id,
                touchCreatedAt: false,
              });
              orgPromoted += 1;
              queueDraftsPromoted += 1;
            }
          } else if (
            !qItem &&
            !isHeldFromAutoPipeline(updatedOrg.importMetadata) &&
            hasNamedSendable &&
            (opp.status === "awaiting_contact" || opp.status === "new" || opp.status === "researching")
          ) {
            const { data: scoreRow } = await db
              .from("prospect_scores")
              .select("id, total_score")
              .eq("opportunity_id", opp.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (scoreRow && Number(scoreRow.total_score) >= 70) {
              await createOrUpdateQueueItem({
                opportunityId: opp.id,
                outreachDraftId: ensured.primaryDraft.id,
                prospectScoreId: String(scoreRow.id),
                duplicateWarning: Boolean(updatedOrg.duplicateOfOrganizationId),
                touchCreatedAt: true,
              });
              await updateOpportunityStatus(opp.id, "ready_for_review");
              orgEnqueued += 1;
              newlyEnqueued += 1;
            }
          }
        }
      } else if (
        opps.length === 0 &&
        !isHeldFromAutoPipeline(updatedOrg.importMetadata) &&
        updatedOrg.importMetadata?.wfeaSalesTarget === true &&
        hasNamedSendable
      ) {
        const orgTypeKey = updatedOrg.organizationTypeId
          ? orgTypeKeyById.get(updatedOrg.organizationTypeId) ?? "other"
          : "other";
        const manual = await enqueueOrgManually({
          organization: updatedOrg,
          title: `${updatedOrg.name} — WFEA network / participatory gathering`,
          description:
            "WFEA member directory target enriched with verified Hunter contacts — explore a participatory anthem or shared-creation moment for their gathering.",
          eventOrInitiativeName: "WFEA network outreach",
          opportunityTypeKey: wfeaOpportunityTypeKey(orgTypeKey),
          totalScoreHint: 74,
        });
        await updateOpportunityTouchTimestamps(manual.opportunityId, {
          nextFollowUpAt: followUpPresetIso("next_week"),
        });
        const freshOpp = await getOpportunity(manual.opportunityId);
        void freshOpp;
        orgEnqueued += 1;
        newlyEnqueued += 1;
      }

      const finalOrg = (await getOrganization(freshOrg.id)) ?? updatedOrg;
      const cleanMeta = { ...(finalOrg.importMetadata ?? {}) };
      delete cleanMeta.hunterSweepLeaseUntil;
      cleanMeta[HUNTER_SWEEP_FLAG] = true;
      cleanMeta.hunterSweepStats = {
        at: new Date().toISOString(),
        tier: candidate.tier,
        added: orgAdded,
        verified: orgVerified,
        upgradedFromGeneric: orgUpgraded,
        queuePromoted: orgPromoted,
        enqueued: orgEnqueued,
        creditsDelta: orgCreditsDelta,
      };
      await updateOrganization(finalOrg.id, { importMetadata: cleanMeta });

      processedOrgs.push({
        name: finalOrg.name,
        domain,
        tier: candidate.tier,
        added: orgAdded,
        verified: orgVerified,
        upgradedFromGeneric: orgUpgraded,
        queuePromoted: orgPromoted,
        enqueued: orgEnqueued,
        creditsDelta: orgCreditsDelta,
      });
    } catch (err) {
      errors.push({
        name: candidate.org.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Price newly enqueued opportunities and refresh the 30-day Gmail draft lineup.
  if (contactsAdded > 0 || contactsVerified > 0 || queueDraftsPromoted > 0 || newlyEnqueued > 0) {
    await drainAnthemPricing({ limit: 40, budgetMs: 12_000 }).catch(() => null);
    await refreshAutoSendPlan().catch(() => null);
  }

  const after = await getHunterAccountCredits();
  const afterRemaining =
    after.creditsAvailable != null && after.creditsUsed != null
      ? after.creditsAvailable - after.creditsUsed
      : null;
  const batchDelta =
    before.creditsUsed != null && after.creditsUsed != null
      ? Math.max(0, Math.round((after.creditsUsed - before.creditsUsed) * 10) / 10)
      : null;

  const remainingEligible = Math.max(0, candidates.length - batchAttempted);
  const done =
    remainingEligible === 0 ||
    (afterRemaining != null && afterRemaining < HUNTER_SWEEP_CREDIT_RESERVE);

  return {
    ok: errors.length === 0,
    done,
    stoppedReason: done && !stoppedReason ? "completed" : stoppedReason,
    seedsEnsured,
    enrichmentErrorsCleared,
    batchAttempted,
    contactsAdded,
    contactsVerified,
    bouncesDetected,
    upgradedFromGeneric,
    queueDraftsPromoted,
    newlyEnqueued,
    remainingEligible,
    remainingByTier: tierCounts,
    credits: {
      beforeUsed: before.creditsUsed,
      afterUsed: after.creditsUsed,
      batchDelta,
      available: after.creditsAvailable,
      remaining: afterRemaining,
    },
    processedOrgs,
    errors,
  };
}

/** Public read-only status summary (names + counts + credit balance only, no emails). */
export async function getHunterSweepStatus(): Promise<{
  credits: {
    planName: string | null;
    used: number | null;
    available: number | null;
    remaining: number | null;
    resetDate: string | null;
  };
  sweptOrganizations: number;
  remainingEligible: number;
  remainingByTier: Record<SweepTier, number>;
  totals: {
    contactsAdded: number;
    contactsVerified: number;
    upgradedFromGeneric: number;
    queueDraftsPromoted: number;
    newlyEnqueued: number;
    trackedCreditsSpent: number;
  };
  done: boolean;
  recentUpgrades: Array<{
    name: string;
    tier: string;
    added: number;
    verified: number;
    upgradedFromGeneric: number;
    queuePromoted: number;
    enqueued: number;
    at: string;
  }>;
}> {
  const [acc, snapshot, orgs] = await Promise.all([
    getHunterAccountCredits(),
    collectSweepCandidates({ force: false }),
    fetchAllPaged<OrgRow>("organizations", "id, name, import_metadata, created_at"),
  ]);

  let contactsAdded = 0;
  let contactsVerified = 0;
  let upgradedFromGeneric = 0;
  let queueDraftsPromoted = 0;
  let newlyEnqueued = 0;
  let trackedCreditsSpent = 0;
  const upgrades: Array<{
    name: string;
    tier: string;
    added: number;
    verified: number;
    upgradedFromGeneric: number;
    queuePromoted: number;
    enqueued: number;
    at: string;
  }> = [];

  for (const org of orgs) {
    const meta = org.import_metadata ?? {};
    if (meta[HUNTER_SWEEP_FLAG] !== true) continue;
    const stats = (meta.hunterSweepStats ?? {}) as Record<string, unknown>;
    const added = typeof stats.added === "number" ? stats.added : 0;
    const verified = typeof stats.verified === "number" ? stats.verified : 0;
    const upgraded = typeof stats.upgradedFromGeneric === "number" ? stats.upgradedFromGeneric : 0;
    const promoted = typeof stats.queuePromoted === "number" ? stats.queuePromoted : 0;
    const enq = typeof stats.enqueued === "number" ? stats.enqueued : 0;
    const delta = typeof stats.creditsDelta === "number" ? stats.creditsDelta : 0;
    contactsAdded += added;
    contactsVerified += verified;
    upgradedFromGeneric += upgraded;
    queueDraftsPromoted += promoted;
    newlyEnqueued += enq;
    trackedCreditsSpent += delta;

    if (added > 0 || upgraded > 0 || promoted > 0 || enq > 0 || verified > 0) {
      upgrades.push({
        name: org.name,
        tier: typeof stats.tier === "string" ? stats.tier : "unknown",
        added,
        verified,
        upgradedFromGeneric: upgraded,
        queuePromoted: promoted,
        enqueued: enq,
        at: typeof stats.at === "string" ? stats.at : org.created_at,
      });
    }
  }

  upgrades.sort((a, b) => b.at.localeCompare(a.at));

  const remaining =
    acc.creditsAvailable != null && acc.creditsUsed != null
      ? acc.creditsAvailable - acc.creditsUsed
      : null;

  return {
    credits: {
      planName: acc.planName,
      used: acc.creditsUsed,
      available: acc.creditsAvailable,
      remaining,
      resetDate: acc.resetDate,
    },
    sweptOrganizations: snapshot.alreadySweptCount,
    remainingEligible: snapshot.candidates.length,
    remainingByTier: snapshot.tierCounts,
    totals: {
      contactsAdded,
      contactsVerified,
      upgradedFromGeneric,
      queueDraftsPromoted,
      newlyEnqueued,
      trackedCreditsSpent: Math.round(trackedCreditsSpent * 10) / 10,
    },
    done:
      snapshot.candidates.length === 0 ||
      (remaining != null && remaining < HUNTER_SWEEP_CREDIT_RESERVE),
    recentUpgrades: upgrades.slice(0, 40),
  };
}
