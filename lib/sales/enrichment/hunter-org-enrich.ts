import {
  createContact,
  findExistingContact,
  listContactsForOrganization,
  markContactEnriched,
  updateContact,
} from "@/lib/sales/db/contacts";
import { updateOrganization } from "@/lib/sales/db/organizations";
import {
  extractDomain,
  genericMailboxLabel,
  isGenericMailboxEmail,
  isPlausibleEmail,
  looksLikePersonName,
  normalizeEmail,
} from "@/lib/sales/dedupe";
import { getEnrichmentConfigStatus } from "@/lib/sales/enrichment/config-status";
import { enrichWithHunter } from "@/lib/sales/enrichment/hunter";
import { getHunterAccountCredits } from "@/lib/sales/enrichment/hunter-account";
import {
  searchHunterDomain,
  type HunterDomainSearchPerson,
} from "@/lib/sales/enrichment/hunter-domain-search";
import {
  MAX_HUNTER_CONTACTS_PER_ORG,
  MAX_HUNTER_CREDITS_PER_ORG,
  hunterContactSlotsRemaining,
  hunterCreditBudgetRemaining,
  hunterPersonRank,
  withHunterCreditsSpent,
} from "@/lib/sales/enrichment/hunter-org-budget";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import { isDoNotProspect } from "@/lib/sales/prospecting/do-not-prospect";
import { SSC_SHARED_PLATFORM_DOMAINS } from "@/lib/sales/seed/seattle-sports-partners";
import type { Contact, Organization } from "@/lib/sales/types";

const EXTRA_SHARED_DOMAINS = new Set([
  "hyatt.com",
  "ihg.com",
  "accor.com",
  "fourseasons.com",
  "fairmont.com",
  "nba.com",
  "nfl.com",
  "wnba.com",
  "mlssoccer.com",
  "eventbrite.com",
  "lu.ma",
  "meetup.com",
  "cvent.com",
  "whova.com",
  "splashthat.com",
  "squarespace.com",
  "wix.com",
  "wixsite.com",
  "weebly.com",
  "wordpress.com",
  "blogspot.com",
  "godaddysites.com",
  "myshopify.com",
  "carrd.co",
  "substack.com",
  "notion.site",
  "linktr.ee",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "google.com",
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "comcast.net",
  "seattleschools.org",
]);

const SHARED_SUFFIX_DOMAINS = [
  ".squarespace.com",
  ".wixsite.com",
  ".weebly.com",
  ".wordpress.com",
  ".blogspot.com",
  ".godaddysites.com",
  ".myshopify.com",
  ".splashthat.com",
  ".notion.site",
  ".eventbrite.com",
];

/** True when Domain Search on `domain` would return platform/chain staff rather than this org's team. */
export function isSharedOrPlatformDomain(domain: string | null | undefined): boolean {
  if (!domain) return true;
  const clean = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!clean || !clean.includes(".")) return true;
  if (SSC_SHARED_PLATFORM_DOMAINS.has(clean) || EXTRA_SHARED_DOMAINS.has(clean)) return true;
  return SHARED_SUFFIX_DOMAINS.some((suffix) => clean.endsWith(suffix));
}

/** True when a contact is a real named person with a non-generic, non-bouncing email. */
export function isNamedPersonalSendableContact(contact: Contact | null | undefined): boolean {
  if (!contact || contact.duplicateOfContactId) return false;
  if (!looksLikePersonName(contact.fullName)) return false;
  if (!contact.email || !isPlausibleEmail(contact.email)) return false;
  if (contact.emailVerificationStatus === "invalid") return false;
  if (isGenericMailboxEmail(contact.email)) return false;
  return true;
}

/** True when an org has NO sendable named personal contact (only generic inboxes, missing emails, or bounces). */
export function organizationHasOnlyWeakContacts(contacts: Contact[]): boolean {
  return contacts.filter(isNamedPersonalSendableContact).length === 0;
}

const NON_BUYER_BACK_OFFICE =
  /\b(accounts?\s+(payable|receivable)|bookkeeper|payroll|billing\s+(specialist|clerk|coordinator)|tax\s+(manager|director|specialist)|internal\s+audit|general\s+counsel|paralegal|compliance\s+officer|database\s+administrator|network\s+engineer|devops|information\s+security|cybersecurity|it\s+(support|helpdesk|technician|administrator)|janitorial|custodian|warehouse)\b/i;

export function isNonBuyerBackOfficeRole(
  position: string | null | undefined,
  department?: string | null | undefined
): boolean {
  const dept = (department ?? "").trim().toLowerCase();
  if (dept === "it" || dept === "legal" || dept === "finance") {
    const p = (position ?? "").toLowerCase();
    if (!/\b(ceo|coo|president|founder|executive\s+director|events?|marketing|development)\b/.test(p)) {
      return true;
    }
  }
  if (!position) return false;
  return NON_BUYER_BACK_OFFICE.test(position);
}

/** Ranks Hunter Domain Search candidates by Crowdsource Choir buyer relevance + seniority. */
export function buyerFitHunterRank(
  person: {
    position?: string | null;
    department?: string | null;
    seniority?: string | null;
    confidence?: number | null;
  },
  context?: {
    salesInitiative?: string | null;
    opportunityTypeKey?: string | null;
  }
): number {
  const base = hunterPersonRank(person);
  const pos = (person.position ?? "").toLowerCase();
  const dept = (person.department ?? "").toLowerCase();
  if (isNonBuyerBackOfficeRole(person.position, person.department)) {
    return base - 120;
  }

  let fit = 0;
  const initiative = context?.salesInitiative ?? "";
  const oppType = context?.opportunityTypeKey ?? "";

  const isEventsRole =
    /\b(events?|conference|congress|summit|programming|agenda|content|experience|production|entertainment|festival|meetings?|convening|education|engagement)\b/.test(
      pos
    );
  const isFundraisingRole =
    /\b(development|philanthropy|fundrais|advancement|donor|gala|special\s+events|major\s+gifts|foundation|auction)\b/.test(
      pos
    );
  const isPartnerMarketingRole =
    /\b(partnerships?|sponsorships?|brand|marketing|fan\s+engagement|community|creative|audience|communications|external|promotions)\b/.test(
      pos
    );
  const isBookingRole =
    /\b(agent|booking|talent|speaker|bureau|entertainment|creative|producer|managing\s+partner)\b/.test(pos);
  const isExecRole =
    /\b(ceo|chief\s+executive|coo|chief\s+operating|cmo|chief\s+marketing|president|founder|co-founder|executive\s+director|managing\s+director|general\s+manager|principal)\b/.test(
      pos
    );

  if (initiative === "fundraising_galas" || oppType === "fundraising_gala") {
    if (isFundraisingRole) fit += 55;
    else if (isEventsRole) fit += 45;
    else if (isExecRole) fit += 35;
    else if (isPartnerMarketingRole) fit += 25;
  } else if (initiative === "booking_agents") {
    if (isBookingRole) fit += 55;
    else if (isExecRole) fit += 40;
    else if (isEventsRole || isPartnerMarketingRole) fit += 30;
  } else if (initiative === "sponsor_partners" || initiative === "sports_fan_culture") {
    if (isPartnerMarketingRole || isEventsRole) fit += 50;
    else if (isExecRole) fit += 35;
  } else {
    if (isEventsRole) fit += 55;
    else if (isPartnerMarketingRole) fit += 38;
    else if (isExecRole) fit += 35;
    else if (isFundraisingRole) fit += 25;
  }

  if (dept === "marketing" || dept === "communication") fit += 10;
  if (dept === "executive" || dept === "management") fit += 8;

  return base + fit;
}

export type NamedPersonHint = {
  fullName: string;
  roleTitle?: string | null;
  roleCategory?: string | null;
};

export type EnrichOrganizationWithHunterOptions = {
  /** Also verify existing named personal contacts currently at `unverified` / `valid_format`. */
  verifyExistingNamed?: boolean;
  /** Allow Domain Search even if 1 named personal contact exists alongside a generic inbox. */
  topUpSingleNamedWithGeneric?: boolean;
  /** Skip blind Domain Search (e.g. when multiple CRM orgs share a parent domain), while still verifying/finding named people. */
  skipDomainSearch?: boolean;
  salesInitiative?: string | null;
  opportunityTypeKey?: string | null;
  namedPeopleHints?: NamedPersonHint[];
};

export type EnrichOrganizationWithHunterResult = {
  organizationId: string;
  domain: string | null;
  skippedReason: string | null;
  verifiedExistingCount: number;
  bouncedExistingCount: number;
  finderAttempted: number;
  finderFound: number;
  upgradedFromGenericCount: number;
  domainSearchAttempted: boolean;
  domainSearchReturned: number;
  domainSearchAdded: number;
  creditsDelta: number;
  addedContacts: Array<{ id: string; fullName: string | null; email: string | null; roleTitle: string | null }>;
};

function personFullName(person: HunterDomainSearchPerson): string | null {
  const first = (person.firstName ?? "").trim();
  const last = (person.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return looksLikePersonName(full) ? full : null;
}

function splitFirstLast(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export async function enrichOrganizationWithHunter(
  organization: Organization,
  options: EnrichOrganizationWithHunterOptions = {}
): Promise<EnrichOrganizationWithHunterResult> {
  const empty = (skippedReason: string | null, domain: string | null = null): EnrichOrganizationWithHunterResult => ({
    organizationId: organization.id,
    domain,
    skippedReason,
    verifiedExistingCount: 0,
    bouncedExistingCount: 0,
    finderAttempted: 0,
    finderFound: 0,
    upgradedFromGenericCount: 0,
    domainSearchAttempted: false,
    domainSearchReturned: 0,
    domainSearchAdded: 0,
    creditsDelta: 0,
    addedContacts: [],
  });

  const config = getEnrichmentConfigStatus();
  if (!config.ready) return empty("hunter_not_configured");
  if (organization.isExistingClient) return empty("existing_client");
  if (isDoNotProspect(organization.importMetadata)) return empty("do_not_prospect");

  const domain = extractDomain(organization.websiteUrl ?? organization.domain);
  if (!domain) return empty("no_domain", null);

  let budgetLeft = hunterCreditBudgetRemaining(organization);
  if (budgetLeft < 0.5) return empty("org_credit_budget_reached", domain);

  const beforeCredits = await getHunterAccountCredits();
  if (!beforeCredits.ok) return empty(beforeCredits.error ?? "hunter_account_error", domain);
  const accountRemaining =
    beforeCredits.creditsAvailable != null && beforeCredits.creditsUsed != null
      ? beforeCredits.creditsAvailable - beforeCredits.creditsUsed
      : null;
  if (accountRemaining != null && accountRemaining < 1) {
    return empty("account_credits_exhausted", domain);
  }

  let contacts = await listContactsForOrganization(organization.id);
  let verifiedExistingCount = 0;
  let bouncedExistingCount = 0;
  let finderAttempted = 0;
  let finderFound = 0;
  let upgradedFromGenericCount = 0;
  let domainSearchAttempted = false;
  let domainSearchReturned = 0;
  let domainSearchAdded = 0;
  const addedContacts: EnrichOrganizationWithHunterResult["addedContacts"] = [];

  const liveCreditsUsed = async (): Promise<number> => {
    const snap = await getHunterAccountCredits();
    if (beforeCredits.creditsUsed == null || snap.creditsUsed == null) return 0;
    return Math.max(0, Math.round((snap.creditsUsed - beforeCredits.creditsUsed) * 10) / 10);
  };

  // Step 1: Verify existing named personal contacts still at valid_format / unverified.
  if (options.verifyExistingNamed) {
    const toVerify = contacts
      .filter(
        (c) =>
          !c.duplicateOfContactId &&
          looksLikePersonName(c.fullName) &&
          c.email &&
          isPlausibleEmail(c.email) &&
          !isGenericMailboxEmail(c.email) &&
          (c.emailVerificationStatus === "valid_format" || c.emailVerificationStatus === "unverified") &&
          !(c.importMetadata && typeof c.importMetadata.hunterVerifier === "string" && c.importMetadata.hunterVerifier !== "error")
      )
      .slice(0, MAX_HUNTER_CONTACTS_PER_ORG);

    for (const c of toVerify) {
      const spent = await liveCreditsUsed();
      if (budgetLeft - spent < 0.5) break;
      const verified = await verifyEmailAddress(c.email!);
      if (!verified.hunterStatus && verified.status === "unverified") continue;

      const wasSeededManually = Boolean(c.importMetadata?.seededManually);
      let nextStatus = c.emailVerificationStatus;
      if (verified.status === "verified_deliverable") {
        nextStatus = "verified_deliverable";
        verifiedExistingCount += 1;
      } else if (verified.status === "invalid") {
        nextStatus = "invalid";
        bouncedExistingCount += 1;
      } else if (verified.status === "risky" && !wasSeededManually) {
        nextStatus = "risky";
      }

      await updateContact(c.id, {
        emailVerificationStatus: nextStatus,
        importMetadata: {
          ...(c.importMetadata ?? {}),
          hunterVerifier: verified.hunterStatus ?? verified.status,
          hunterVerifiedAt: new Date().toISOString(),
        },
      });
    }
    if (toVerify.length > 0) {
      contacts = await listContactsForOrganization(organization.id);
    }
  }

  // Step 2: Hunter Email Finder for named people missing an email OR stuck on a generic inbox, plus hints.
  if (!isSharedOrPlatformDomain(domain)) {
    const existingEmails = new Set(
      contacts.map((c) => c.normalizedEmail ?? normalizeEmail(c.email)).filter((e): e is string => Boolean(e))
    );
    const existingNames = new Set(
      contacts.map((c) => (c.fullName ?? "").trim().toLowerCase()).filter(Boolean)
    );

    const finderTargets = contacts.filter((c) => {
      if (c.duplicateOfContactId || !looksLikePersonName(c.fullName)) return false;
      if (!c.email) {
        return !c.enrichmentAttemptedAt || c.enrichmentStatus === "error";
      }
      if (isGenericMailboxEmail(c.email)) {
        return !(c.importMetadata?.hunterFinderAttempted === true);
      }
      return false;
    });

    for (const contact of finderTargets.slice(0, MAX_HUNTER_CONTACTS_PER_ORG)) {
      const spent = await liveCreditsUsed();
      if (budgetLeft - spent < 1) break;
      const parts = splitFirstLast(contact.fullName!);
      if (!parts) continue;

      finderAttempted += 1;
      const found = await enrichWithHunter({
        domain,
        firstName: parts.firstName,
        lastName: parts.lastName,
      });

      if (!contact.email) {
        await markContactEnriched(contact.id, {
          provider: "hunter",
          status: found.status,
          email: found.email,
        });
      } else {
        await updateContact(contact.id, {
          importMetadata: {
            ...(contact.importMetadata ?? {}),
            hunterFinderAttempted: true,
            hunterFinderStatus: found.status,
          },
        });
      }

      const foundEmail = normalizeEmail(found.email);
      if (found.status !== "found" || !foundEmail || !isPlausibleEmail(foundEmail) || isGenericMailboxEmail(foundEmail)) {
        continue;
      }

      const spentAfterFinder = await liveCreditsUsed();
      let finalStatus: Contact["emailVerificationStatus"] = "valid_format";
      let verifierTag: string | null = null;
      if (budgetLeft - spentAfterFinder >= 0.5) {
        const verified = await verifyEmailAddress(foundEmail);
        verifierTag = verified.hunterStatus;
        if (verified.status === "invalid") {
          if (!contact.email) {
            await updateContact(contact.id, { emailVerificationStatus: "invalid" });
          }
          continue;
        }
        if (verified.status !== "unverified") finalStatus = verified.status;
      }

      const oldGenericEmail = contact.email && isGenericMailboxEmail(contact.email) ? normalizeEmail(contact.email) : null;

      await updateContact(contact.id, {
        email: foundEmail,
        emailVerificationStatus: finalStatus,
        importMetadata: {
          ...(contact.importMetadata ?? {}),
          hunterEmailFinder: true,
          hunterFinderAttempted: true,
          hunterVerifier: verifierTag,
          ...(oldGenericEmail ? { replacedGenericInbox: oldGenericEmail } : {}),
        },
      });
      existingEmails.add(foundEmail);
      finderFound += 1;

      // Preserve the generic inbox as a fallback contact row so nothing is deleted.
      if (oldGenericEmail) {
        upgradedFromGenericCount += 1;
        const otherHasGeneric = contacts.some(
          (other) => other.id !== contact.id && normalizeEmail(other.email) === oldGenericEmail
        );
        if (!otherHasGeneric) {
          await createContact({
            organizationId: organization.id,
            fullName: genericMailboxLabel(oldGenericEmail),
            roleTitle: "Published general inbox",
            roleCategory: contact.roleCategory ?? "events",
            email: oldGenericEmail,
            source: "manual",
            emailVerificationStatus: "valid_format",
            importMetadata: {
              preservedFallbackInbox: true,
              splitFromNamedContactId: contact.id,
            },
          }).catch(() => null);
        }
      }
    }

    // Also try any explicit named leader hints (e.g. from ELX / Eudēmonia research blurbs).
    for (const hint of (options.namedPeopleHints ?? []).slice(0, MAX_HUNTER_CONTACTS_PER_ORG)) {
      if (!looksLikePersonName(hint.fullName)) continue;
      if (existingNames.has(hint.fullName.trim().toLowerCase())) continue;
      const spent = await liveCreditsUsed();
      if (budgetLeft - spent < 1) break;
      const parts = splitFirstLast(hint.fullName);
      if (!parts) continue;

      finderAttempted += 1;
      const found = await enrichWithHunter({
        domain,
        firstName: parts.firstName,
        lastName: parts.lastName,
      });
      const foundEmail = normalizeEmail(found.email);
      if (
        found.status !== "found" ||
        !foundEmail ||
        !isPlausibleEmail(foundEmail) ||
        isGenericMailboxEmail(foundEmail) ||
        existingEmails.has(foundEmail)
      ) {
        continue;
      }

      const spentAfterFinder = await liveCreditsUsed();
      let finalStatus: Contact["emailVerificationStatus"] = "valid_format";
      let verifierTag: string | null = null;
      if (budgetLeft - spentAfterFinder >= 0.5) {
        const verified = await verifyEmailAddress(foundEmail);
        verifierTag = verified.hunterStatus;
        if (verified.status === "invalid") continue;
        if (verified.status !== "unverified") finalStatus = verified.status;
      }

      const created = await createContact({
        organizationId: organization.id,
        fullName: hint.fullName.trim(),
        roleTitle: hint.roleTitle ?? null,
        roleCategory: hint.roleCategory ?? null,
        email: foundEmail,
        source: "ai_discovered",
        emailVerificationStatus: finalStatus,
        importMetadata: {
          hunterDomainSearch: true,
          hunterEmailFinder: true,
          hunterVerifier: verifierTag,
          roleDescription: hint.roleTitle
            ? `${hint.roleTitle} — found via Hunter Email Finder.`
            : "Found via Hunter Email Finder.",
        },
      });
      existingEmails.add(foundEmail);
      existingNames.add(hint.fullName.trim().toLowerCase());
      finderFound += 1;
      addedContacts.push({
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        roleTitle: created.roleTitle,
      });
    }

    if (finderAttempted > 0) {
      contacts = await listContactsForOrganization(organization.id);
    }
  }

  // Step 3: Hunter Domain Search when the org still has weak contacts (0 named personal contacts,
  // or 1 named + generic inbox when topUpSingleNamedWithGeneric is set).
  const sendableNamed = contacts.filter(isNamedPersonalSendableContact);
  const hasGenericInbox = contacts.some((c) => !c.duplicateOfContactId && isGenericMailboxEmail(c.email));
  const needsDomainSearch =
    !options.skipDomainSearch &&
    !isSharedOrPlatformDomain(domain) &&
    (sendableNamed.length === 0 ||
      (Boolean(options.topUpSingleNamedWithGeneric) && sendableNamed.length === 1 && hasGenericInbox));

  const slotsLeft = hunterContactSlotsRemaining(contacts);
  const spentBeforeDomain = await liveCreditsUsed();

  if (needsDomainSearch && slotsLeft > 0 && budgetLeft - spentBeforeDomain >= 1) {
    domainSearchAttempted = true;
    let search = await searchHunterDomain({
      domain,
      limit: 10,
      type: "personal",
      requiredFields: ["full_name"],
    });

    if (search.ok) {
      domainSearchReturned = search.people.length;
      const eligible = (list: HunterDomainSearchPerson[]) =>
        list.filter(
          (p) =>
            (!p.type || p.type === "personal") &&
            isPlausibleEmail(p.email) &&
            !isGenericMailboxEmail(p.email) &&
            Boolean(personFullName(p)) &&
            !isNonBuyerBackOfficeRole(p.position, p.department)
        );

      let candidates = eligible(search.people);

      // Large domains (>10 total in Hunter) where the first 10 were all IT/finance back-office:
      // spend at most 1 department-filtered search if budget still allows.
      const spentMid = await liveCreditsUsed();
      if (candidates.length === 0 && search.results > 10 && budgetLeft - spentMid >= 1.5) {
        const filtered = await searchHunterDomain({
          domain,
          limit: 10,
          type: "personal",
          requiredFields: ["full_name"],
          departments: ["executive", "marketing", "communication", "management"],
        });
        if (filtered.ok) {
          domainSearchReturned += filtered.people.length;
          candidates = eligible(filtered.people);
        }
      }

      const ranked = [...candidates]
        .sort(
          (a, b) =>
            buyerFitHunterRank(b, {
              salesInitiative: options.salesInitiative,
              opportunityTypeKey: options.opportunityTypeKey,
            }) -
            buyerFitHunterRank(a, {
              salesInitiative: options.salesInitiative,
              opportunityTypeKey: options.opportunityTypeKey,
            })
        )
        .slice(0, Math.min(MAX_HUNTER_CONTACTS_PER_ORG, slotsLeft));

      const existingEmails = new Set(
        contacts.map((c) => c.normalizedEmail ?? normalizeEmail(c.email)).filter((e): e is string => Boolean(e))
      );
      const existingNames = new Set(
        contacts.map((c) => (c.fullName ?? "").trim().toLowerCase()).filter(Boolean)
      );

      for (const person of ranked) {
        if (domainSearchAdded >= slotsLeft) break;
        const fullName = personFullName(person);
        const email = normalizeEmail(person.email);
        if (!fullName || !email) continue;
        if (existingEmails.has(email) || existingNames.has(fullName.toLowerCase())) continue;
        if (person.verificationStatus === "invalid" || person.verificationStatus === "disposable") {
          continue;
        }

        const spentNow = await liveCreditsUsed();
        let finalStatus: Contact["emailVerificationStatus"] = "valid_format";
        let verifierStatus: string | null = person.verificationStatus ?? null;

        if (person.verificationStatus === "valid") {
          finalStatus = "verified_deliverable";
        } else if (budgetLeft - spentNow >= 0.5) {
          const verified = await verifyEmailAddress(email);
          verifierStatus = verified.hunterStatus;
          if (verified.status === "invalid") continue;
          if (verified.status !== "unverified") finalStatus = verified.status;
        } else if (domainSearchAdded > 0) {
          break;
        }

        const existingMatch = await findExistingContact(organization.id, email, fullName);
        if (existingMatch) {
          if (!existingMatch.email || isGenericMailboxEmail(existingMatch.email)) {
            const updated = await updateContact(existingMatch.id, {
              fullName,
              roleTitle: person.position ?? existingMatch.roleTitle,
              roleCategory: person.department ?? existingMatch.roleCategory,
              email,
              phone: person.phone ?? existingMatch.phone,
              linkedinUrl: person.linkedin ?? existingMatch.linkedinUrl,
              emailVerificationStatus: finalStatus,
              importMetadata: {
                ...(existingMatch.importMetadata ?? {}),
                hunterDomainSearch: true,
                hunterConfidence: person.confidence,
                hunterDepartment: person.department,
                hunterSeniority: person.seniority,
                hunterVerifier: verifierStatus,
              },
            });
            domainSearchAdded += 1;
            addedContacts.push({
              id: updated.id,
              fullName: updated.fullName,
              email: updated.email,
              roleTitle: updated.roleTitle,
            });
          }
          existingEmails.add(email);
          existingNames.add(fullName.toLowerCase());
          continue;
        }

        const created = await createContact({
          organizationId: organization.id,
          fullName,
          roleTitle: person.position,
          roleCategory: person.department,
          email,
          phone: person.phone,
          linkedinUrl: person.linkedin,
          source: "ai_discovered",
          emailVerificationStatus: finalStatus,
          importMetadata: {
            hunterDomainSearch: true,
            hunterConfidence: person.confidence,
            hunterDepartment: person.department,
            hunterSeniority: person.seniority,
            hunterVerifier: verifierStatus,
            roleDescription: person.position
              ? `${person.position} — found via Hunter Domain Search.`
              : "Found via Hunter Domain Search.",
          },
        });
        existingEmails.add(email);
        existingNames.add(fullName.toLowerCase());
        domainSearchAdded += 1;
        addedContacts.push({
          id: created.id,
          fullName: created.fullName,
          email: created.email,
          roleTitle: created.roleTitle,
        });
      }
    }
  }

  const totalDelta = await liveCreditsUsed();
  budgetLeft = Math.max(0, MAX_HUNTER_CREDITS_PER_ORG - totalDelta);
  void budgetLeft;
  if (totalDelta > 0) {
    await updateOrganization(organization.id, {
      importMetadata: withHunterCreditsSpent(organization.importMetadata, totalDelta),
    }).catch(() => null);
  }

  return {
    organizationId: organization.id,
    domain,
    skippedReason: null,
    verifiedExistingCount,
    bouncedExistingCount,
    finderAttempted,
    finderFound,
    upgradedFromGenericCount,
    domainSearchAttempted,
    domainSearchReturned,
    domainSearchAdded,
    creditsDelta: totalDelta,
    addedContacts,
  };
}
