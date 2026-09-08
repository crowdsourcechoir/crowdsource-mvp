import { createContact, listContactsForOrganization, updateContact } from "@/lib/sales/db/contacts";
import { assembleQueueItemDetailFromQueueItem } from "@/lib/sales/db/assemble";
import { findExistingOrganization } from "@/lib/sales/db/organizations";
import { listOpportunitiesForOrganization, updateOpportunityStatus } from "@/lib/sales/db/opportunities";
import { createOrUpdateQueueItem, getInitialQueueItemByOpportunity, getQueueItem } from "@/lib/sales/db/queue";
import { extractDomain, normalizeEmail } from "@/lib/sales/dedupe";
import { getHunterAccountCredits } from "@/lib/sales/enrichment/hunter-account";
import { searchHunterDomain, type HunterDomainSearchPerson } from "@/lib/sales/enrichment/hunter-domain-search";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import { ensureContactDrafts } from "@/lib/sales/seed/enqueue-manual";
import type { PastedContact } from "@/lib/sales/seed/parse-contact-paste";
import type { ApprovalQueueItem, Opportunity, Organization, QueueItemDetail } from "@/lib/sales/types";

export type AddPastedContactsResult = {
  detail: QueueItemDetail | null;
  added: Array<{ id: string; fullName: string | null; email: string | null; roleTitle: string | null }>;
  skippedExisting: number;
  skippedInvalid: number;
  hunterReturned: number;
  matched: number;
  query: string;
  domain: string | null;
  targetQueueItemId: string;
  targetOrganizationName: string;
  switchedOrganization: boolean;
  credits: {
    beforeUsed: number | null;
    afterUsed: number | null;
    delta: number | null;
    available: number | null;
  };
  hunter: { attempted: boolean; error: string | null };
  message: string;
};

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

async function resolvePasteTarget(input: {
  organization: Organization;
  opportunity: Opportunity;
  item: ApprovalQueueItem;
  pasted: PastedContact[];
}): Promise<{
  organization: Organization;
  opportunity: Opportunity;
  item: ApprovalQueueItem;
  switched: boolean;
}> {
  const domains = Array.from(
    new Set(
      input.pasted
        .map((p) => extractDomain(p.email))
        .filter((d): d is string => Boolean(d))
    )
  );
  const currentDomain = extractDomain(input.organization.websiteUrl ?? input.organization.domain);
  if (domains.length !== 1 || !domains[0] || domains[0] === currentDomain) {
    return {
      organization: input.organization,
      opportunity: input.opportunity,
      item: input.item,
      switched: false,
    };
  }

  const other = await findExistingOrganization(domains[0], `https://${domains[0]}`);
  if (!other || other.id === input.organization.id) {
    return {
      organization: input.organization,
      opportunity: input.opportunity,
      item: input.item,
      switched: false,
    };
  }

  const opps = await listOpportunitiesForOrganization(other.id);
  for (const opp of opps) {
    const qi = await getInitialQueueItemByOpportunity(opp.id);
    if (qi) {
      return { organization: other, opportunity: opp, item: qi, switched: true };
    }
  }

  return {
    organization: input.organization,
    opportunity: input.opportunity,
    item: input.item,
    switched: false,
  };
}

/**
 * Paste path for Find more: Name: email lists → create contacts and pull titles
 * from Hunter Domain Search on each email's domain (not a role keyword search).
 */
export async function addPastedContactsForQueueItem(input: {
  organization: Organization;
  opportunity: Opportunity;
  item: ApprovalQueueItem;
  pasted: PastedContact[];
  query: string;
}): Promise<AddPastedContactsResult> {
  const target = await resolvePasteTarget(input);
  const { organization, opportunity, item } = target;
  const wasDecided = item.status !== "pending";

  const before = await getHunterAccountCredits();
  const byDomain = new Map<string, PastedContact[]>();
  for (const person of input.pasted) {
    const domain = extractDomain(person.email);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(person);
    byDomain.set(domain, list);
  }

  const hunterByEmail = new Map<string, HunterDomainSearchPerson>();
  let hunterReturned = 0;
  let hunterError: string | null = null;
  for (const [domain] of Array.from(byDomain.entries())) {
    const search = await searchHunterDomain({
      domain,
      limit: 100,
      type: "personal",
    });
    if (!search.ok && search.error) hunterError = search.error;
    hunterReturned += search.people.length;
    for (const person of search.people) {
      const email = normalizeEmail(person.email);
      if (email) hunterByEmail.set(email, person);
    }
  }

  const after = await getHunterAccountCredits();
  const credits = {
    beforeUsed: before.creditsUsed,
    afterUsed: after.creditsUsed,
    delta: creditDelta(before.creditsUsed, after.creditsUsed),
    available: after.creditsAvailable,
  };

  const existing = await listContactsForOrganization(organization.id);
  const existingEmails = new Set(
    existing.map((c) => c.normalizedEmail ?? normalizeEmail(c.email)).filter((e): e is string => Boolean(e))
  );

  const added: AddPastedContactsResult["added"] = [];
  let skippedExisting = 0;
  let skippedInvalid = 0;
  let titlesFound = 0;

  for (const pasted of input.pasted) {
    const email = normalizeEmail(pasted.email);
    if (!email) continue;

    const hunter = hunterByEmail.get(email) ?? null;
    const roleTitle = hunter?.position?.trim() || null;
    const roleCategory = hunter?.department ?? null;
    if (roleTitle) titlesFound += 1;

    if (existingEmails.has(email)) {
      const existingContact = existing.find(
        (c) => (c.normalizedEmail ?? normalizeEmail(c.email)) === email
      );
      if (existingContact && roleTitle && !existingContact.roleTitle) {
        const updated = await updateContact(existingContact.id, {
          roleTitle,
          roleCategory,
        });
        added.push({
          id: updated.id,
          fullName: updated.fullName,
          email: updated.email,
          roleTitle: updated.roleTitle,
        });
      } else {
        skippedExisting += 1;
      }
      continue;
    }

    const verified = await verifyEmailAddress(email);
    if (verified.status === "invalid") {
      skippedInvalid += 1;
      continue;
    }

    const contact = await createContact({
      organizationId: organization.id,
      fullName: pasted.fullName,
      roleTitle,
      roleCategory,
      email,
      phone: hunter?.phone ?? null,
      linkedinUrl: hunter?.linkedin ?? null,
      source: "manual",
      emailVerificationStatus:
        verified.status === "unverified" ? "valid_format" : verified.status,
      importMetadata: {
        pastedContact: true,
        hunterDomainSearch: Boolean(hunter),
        hunterConfidence: hunter?.confidence ?? null,
        hunterDepartment: hunter?.department ?? null,
        hunterSeniority: hunter?.seniority ?? null,
        hunterVerifier: verified.hunterStatus,
        roleDescription: roleTitle
          ? `${roleTitle} — pasted contact; title from Hunter.`
          : `Pasted contact (${email}).`,
      },
    });

    existingEmails.add(email);
    added.push({
      id: contact.id,
      fullName: contact.fullName,
      email: contact.email,
      roleTitle: contact.roleTitle,
    });
  }

  let reopened = false;
  if (added.length > 0) {
    const created = await ensureContactDrafts({
      organization,
      opportunityId: opportunity.id,
      pipelineRunId: null,
    });
    if (wasDecided) {
      const addedIds = new Set(added.map((c) => c.id));
      const openForAdded = created.drafts.find(
        (d) =>
          d.contactId != null &&
          addedIds.has(d.contactId) &&
          (d.status === "draft" || d.status === "qa_flagged")
      );
      const draft = openForAdded ?? created.primaryDraft;
      await createOrUpdateQueueItem({
        opportunityId: opportunity.id,
        outreachDraftId: draft.id,
        prospectScoreId: item.prospectScoreId,
        reopenDecided: true,
      });
      if (item.kind === "initial") {
        await updateOpportunityStatus(opportunity.id, "ready_for_review");
      }
      reopened = true;
    }
  }

  const refreshed = await getQueueItem(item.id);
  const detail = refreshed
    ? await assembleQueueItemDetailFromQueueItem(refreshed)
    : await assembleQueueItemDetailFromQueueItem(item);

  const creditBit = creditPhrase(credits.delta);
  const reopenBit = reopened ? " Reopened in To send." : "";
  const titleBit =
    titlesFound > 0
      ? ` Titles for ${titlesFound}.`
      : added.length > 0
        ? " Hunter had no titles for these addresses yet — names saved."
        : "";
  const switchBit = target.switched
    ? ` Added on ${organization.name} (email domain), not the org you had open.`
    : "";

  const domains = Array.from(byDomain.keys());
  const domainLabel = domains.join(", ") || null;

  let message: string;
  if (added.length === 0) {
    const bounceNote = skippedInvalid > 0 ? ` Skipped ${skippedInvalid} that would bounce.` : "";
    message =
      skippedExisting > 0
        ? `Those contacts are already on ${organization.name}.${bounceNote}${creditBit}`
        : `Could not add pasted contacts.${bounceNote}${creditBit}`;
  } else {
    const names = added
      .map((c) => (c.roleTitle ? `${c.fullName} (${c.roleTitle})` : c.fullName))
      .filter(Boolean)
      .join(", ");
    message = `Added ${added.length} pasted contact${added.length === 1 ? "" : "s"}: ${names}.${titleBit}${switchBit}${creditBit}${reopenBit}`;
  }

  return {
    detail,
    added,
    skippedExisting,
    skippedInvalid,
    hunterReturned,
    matched: input.pasted.length,
    query: input.query,
    domain: domainLabel,
    targetQueueItemId: item.id,
    targetOrganizationName: organization.name,
    switchedOrganization: target.switched,
    credits,
    hunter: { attempted: true, error: hunterError },
    message,
  };
}
