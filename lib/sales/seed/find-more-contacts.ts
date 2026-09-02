import { createContact, listContactsForOrganization } from "@/lib/sales/db/contacts";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { getOrganization } from "@/lib/sales/db/organizations";
import { getOpportunity } from "@/lib/sales/db/opportunities";
import { getQueueItem } from "@/lib/sales/db/queue";
import { extractDomain, isPlausibleEmail, looksLikePersonName, normalizeEmail } from "@/lib/sales/dedupe";
import { getHunterAccountCredits } from "@/lib/sales/enrichment/hunter-account";
import { describeFindQuery, hunterPersonMatchesQuery, parseFindQuery } from "@/lib/sales/enrichment/find-query";
import { searchHunterDomain, type HunterDomainSearchPerson } from "@/lib/sales/enrichment/hunter-domain-search";
import { getEnrichmentConfigStatus } from "@/lib/sales/enrichment/config-status";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import { ensureContactDrafts } from "@/lib/sales/seed/enqueue-manual";
import type { QueueItemDetail } from "@/lib/sales/types";

const MAX_RESULTS = 10;

export type FindMoreContactsInput = {
  itemId: string;
  query: string;
};

export type FindMoreContactsResult = {
  detail: QueueItemDetail | null;
  added: Array<{ id: string; fullName: string | null; email: string | null; roleTitle: string | null }>;
  skippedExisting: number;
  skippedInvalid: number;
  hunterReturned: number;
  matched: number;
  query: string;
  domain: string | null;
  credits: {
    beforeUsed: number | null;
    afterUsed: number | null;
    delta: number | null;
    available: number | null;
  };
  hunter: { attempted: boolean; error: string | null };
  message: string;
};

function personFullName(person: HunterDomainSearchPerson): string | null {
  const first = (person.firstName ?? "").trim();
  const last = (person.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return looksLikePersonName(full) ? full : null;
}

function creditDelta(before: number | null, after: number | null): number | null {
  if (before == null || after == null) return null;
  return Math.max(0, after - before);
}

function creditPhrase(delta: number | null): string {
  if (delta == null) return "";
  if (delta === 0) return " Hunter used 0 credits.";
  if (delta === 1) return " Hunter used 1 credit.";
  return ` Hunter used ${delta} credits.`;
}

/**
 * Hunter Domain Search for this queue org, then insert matching people into
 * the same contacts grid (no screen change). Does not steal the selected contact.
 */
export async function findMoreContactsForQueueItem(input: FindMoreContactsInput): Promise<FindMoreContactsResult> {
  const query = input.query.trim();
  if (!query) throw new Error("Say who to look for — e.g. events team, director of development.");

  const config = getEnrichmentConfigStatus();
  if (!config.ready) {
    throw new Error(config.message ?? "HUNTER_API_KEY is missing.");
  }

  const item = await getQueueItem(input.itemId);
  if (!item) throw new Error("Queue item not found.");
  if (item.status !== "pending") throw new Error("Queue item already decided.");
  const opportunity = await getOpportunity(item.opportunityId);
  if (!opportunity) throw new Error("Opportunity not found.");
  const organization = await getOrganization(opportunity.organizationId);
  if (!organization) throw new Error("Organization not found.");

  const domain = extractDomain(organization.websiteUrl ?? organization.domain);
  const emptyCredits = { beforeUsed: null, afterUsed: null, delta: null, available: null };
  if (!domain) {
    return {
      detail: await assembleQueueItemDetailFromQueueItem(item),
      added: [],
      skippedExisting: 0,
      skippedInvalid: 0,
      hunterReturned: 0,
      matched: 0,
      query,
      domain: null,
      credits: emptyCredits,
      hunter: { attempted: false, error: "Need a website/domain on this organization for Hunter." },
      message: "Need a website/domain on this organization for Hunter.",
    };
  }

  const parsed = parseFindQuery(query);
  if (parsed.keywords.length === 0 && parsed.jobTitles.length === 0 && parsed.departments.length === 0) {
    throw new Error("Say who to look for — e.g. events team, director of development.");
  }
  const before = await getHunterAccountCredits();
  let search = await searchHunterDomain({
    domain,
    limit: MAX_RESULTS,
    type: "personal",
    requiredFields: ["full_name"],
    jobTitles: parsed.jobTitles,
    departments: parsed.departments,
    seniority: parsed.seniority,
    decisionMaker: parsed.decisionMaker,
  });

  const after = await getHunterAccountCredits();
  const credits = {
    beforeUsed: before.creditsUsed,
    afterUsed: after.creditsUsed,
    delta: creditDelta(before.creditsUsed, after.creditsUsed),
    available: after.creditsAvailable,
  };

  if (!search.ok) {
    return {
      detail: await assembleQueueItemDetailFromQueueItem(item),
      added: [],
      skippedExisting: 0,
      skippedInvalid: 0,
      hunterReturned: 0,
      matched: 0,
      query,
      domain,
      credits,
      hunter: { attempted: true, error: search.error },
      message: search.error ?? "Hunter lookup failed.",
    };
  }

  const matchesQuery = (p: HunterDomainSearchPerson) => {
    if (p.type && p.type !== "personal") return false;
    if (!isPlausibleEmail(p.email)) return false;
    if (!personFullName(p)) return false;
    return hunterPersonMatchesQuery(
      {
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        department: p.department,
        seniority: p.seniority,
      },
      parsed
    );
  };

  let people = search.people;
  let matchedPeople = people.filter(matchesQuery);

  if (
    people.length === 0 &&
    (parsed.jobTitles.length > 0 || parsed.departments.length > 0)
  ) {
    const broad = await searchHunterDomain({
      domain,
      limit: MAX_RESULTS,
      type: "personal",
      requiredFields: ["full_name"],
    });
    const afterBroad = await getHunterAccountCredits();
    credits.afterUsed = afterBroad.creditsUsed;
    credits.delta = creditDelta(credits.beforeUsed, afterBroad.creditsUsed);
    credits.available = afterBroad.creditsAvailable;
    if (broad.ok) {
      people = broad.people;
      matchedPeople = people.filter(matchesQuery);
    } else if (!search.error) {
      search = broad;
    }
  }

  if (!search.ok && people.length === 0) {
    return {
      detail: await assembleQueueItemDetailFromQueueItem(item),
      added: [],
      skippedExisting: 0,
      skippedInvalid: 0,
      hunterReturned: 0,
      matched: 0,
      query,
      domain,
      credits,
      hunter: { attempted: true, error: search.error },
      message: search.error ?? "Hunter lookup failed.",
    };
  }

  const existing = await listContactsForOrganization(organization.id);
  const existingEmails = new Set(
    existing.map((c) => c.normalizedEmail ?? normalizeEmail(c.email)).filter((e): e is string => Boolean(e))
  );
  const existingNames = new Set(
    existing.map((c) => (c.fullName ?? "").trim().toLowerCase()).filter(Boolean)
  );

  const added: FindMoreContactsResult["added"] = [];
  let skippedExisting = 0;
  let skippedInvalid = 0;

  for (const person of matchedPeople) {
    const fullName = personFullName(person);
    if (!fullName) continue;
    const email = person.email;
    const nameKey = fullName.toLowerCase();

    if (existingEmails.has(email) || existingNames.has(nameKey)) {
      skippedExisting += 1;
      continue;
    }

    const verified = await verifyEmailAddress(email);
    if (verified.status !== "verified_deliverable") {
      skippedInvalid += 1;
      continue;
    }

    const contact = await createContact({
      organizationId: organization.id,
      fullName,
      roleTitle: person.position,
      roleCategory: person.department,
      email,
      phone: person.phone,
      linkedinUrl: person.linkedin,
      source: "ai_discovered",
      emailVerificationStatus: "verified_deliverable",
      importMetadata: {
        hunterQuery: query,
        hunterDomainSearch: true,
        hunterConfidence: person.confidence,
        hunterDepartment: person.department,
        hunterSeniority: person.seniority,
        hunterVerifier: verified.hunterStatus,
        roleDescription: person.position
          ? `${person.position} — found via Hunter for “${query}”.`
          : `Found via Hunter for “${query}”.`,
      },
    });

    existingEmails.add(email);
    existingNames.add(nameKey);
    added.push({
      id: contact.id,
      fullName: contact.fullName,
      email: contact.email,
      roleTitle: contact.roleTitle,
    });
  }

  if (added.length > 0) {
    await ensureContactDrafts({
      organization,
      opportunityId: opportunity.id,
      pipelineRunId: null,
    });
  }

  const refreshed = await getQueueItem(item.id);
  const detail = refreshed ? await assembleQueueItemDetailFromQueueItem(refreshed) : await assembleQueueItemDetailFromQueueItem(item);
  const who = describeFindQuery(parsed);
  const creditBit = creditPhrase(credits.delta);

  let message: string;
  if (added.length === 0 && matchedPeople.length === 0) {
    message =
      people.length === 0
        ? `Hunter found nobody at ${domain} for “${who}”.${creditBit}`
        : `Hunter returned ${people.length} people at ${domain}, but none matched “${who}”.${creditBit}`;
  } else if (added.length === 0) {
    const bounceNote = skippedInvalid > 0 ? ` Hunter rejected ${skippedInvalid} undeliverable address${skippedInvalid === 1 ? "" : "es"}.` : "";
    message =
      skippedExisting > 0
        ? `Hunter already has ${skippedExisting} matching contact${skippedExisting === 1 ? "" : "s"} on this org — nothing new to add.${bounceNote}${creditBit}`
        : `Hunter found matches for “${who}” but none passed deliverability checks.${bounceNote}${creditBit}`;
  } else {
    const names = added.map((c) => c.fullName).filter(Boolean).join(", ");
    const bounceNote = skippedInvalid > 0 ? ` Skipped ${skippedInvalid} that would bounce.` : "";
    message = `Added ${added.length} verified contact${added.length === 1 ? "" : "s"} from Hunter: ${names}.${bounceNote}${creditBit}`;
  }

  return {
    detail,
    added,
    skippedExisting,
    skippedInvalid,
    hunterReturned: people.length,
    matched: matchedPeople.length,
    query,
    domain,
    credits,
    hunter: { attempted: true, error: search.error },
    message,
  };
}
