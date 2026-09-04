import { createContact, findExistingContact, listContactsForOrganization } from "@/lib/sales/db/contacts";
import {
  extractDomain,
  genericMailboxLabel,
  isGenericMailboxEmail,
  isPlausibleEmail,
  isSendableContact,
  looksLikePersonName,
  normalizeEmail,
} from "@/lib/sales/dedupe";
import { hunterPersonMatchesQuery, parseFindQuery } from "@/lib/sales/enrichment/find-query";
import { searchHunterDomain, type HunterDomainSearchPerson } from "@/lib/sales/enrichment/hunter-domain-search";
import { verifyEmailAddress } from "@/lib/sales/enrichment/verify-email";
import type { Contact, Organization } from "@/lib/sales/types";

/** Hunter Domain Search + local filter: event people and general event inboxes. */
export const EVENT_CONTACT_QUERY =
  "events programming community partnerships experience hospitality tickets";

const MAX_HUNTER_ROWS = 20;
const MAX_NEW_CONTACTS = 8;

export type EventContactDiscoveryResult = {
  attempted: boolean;
  hunterReturned: number;
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  error: string | null;
  contacts: Contact[];
};

function personFullName(person: HunterDomainSearchPerson): string | null {
  const first = (person.firstName ?? "").trim();
  const last = (person.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return looksLikePersonName(full) ? full : null;
}

export function isEventRelatedMailbox(email: string | null | undefined): boolean {
  if (!isGenericMailboxEmail(email)) return false;
  const local = (email ?? "").split("@")[0]?.split("+")[0]?.toLowerCase() ?? "";
  return /^(events?|programming|program|community|tickets?|partnerships?|partners?|experience|hospitality|info|contact|hello|inquir(?:y|ies)|press|media|marketing|groups?|box-?office|sponsorship|sponsors?|speakers?|conference|conferences|gala|booking|bookings|development|fundraising)$/i.test(
    local
  );
}

const EVENT_PARSED = parseFindQuery(EVENT_CONTACT_QUERY);

export function hunterRecordIsEventContact(person: HunterDomainSearchPerson): boolean {
  if (!isPlausibleEmail(person.email)) return false;
  if (isEventRelatedMailbox(person.email)) return true;
  const fullName = personFullName(person);
  if (!fullName) return false;
  return hunterPersonMatchesQuery(
    {
      firstName: person.firstName,
      lastName: person.lastName,
      position: person.position,
      department: person.department,
      seniority: person.seniority,
    },
    EVENT_PARSED
  );
}

function rankEventPerson(person: HunterDomainSearchPerson): number {
  const local = (person.email.split("@")[0] ?? "").toLowerCase();
  if (/^events?$/.test(local)) return 0;
  if (/^(programming|community|tickets?|partnerships?)$/.test(local)) return 1;
  if (/^(info|contact|hello)$/.test(local)) return 2;
  if (isGenericMailboxEmail(person.email)) return 3;
  const title = `${person.position ?? ""} ${person.department ?? ""}`.toLowerCase();
  if (/events?|programming|experience/.test(title)) return 4;
  return 5;
}

function displayName(person: HunterDomainSearchPerson): string {
  return personFullName(person) ?? person.position?.trim() ?? genericMailboxLabel(person.email);
}

/**
 * Hunter Domain Search for event-team people and general event inboxes (events@, community@,
 * tickets@, info@). Generic inboxes are sendable without Hunter SMTP-ok; named people still
 * need verified_deliverable.
 */
export async function discoverEventContactsForOrganization(
  org: Organization
): Promise<EventContactDiscoveryResult> {
  const empty: EventContactDiscoveryResult = {
    attempted: false,
    hunterReturned: 0,
    created: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    error: null,
    contacts: [],
  };

  const existing = await listContactsForOrganization(org.id);
  if (existing.some((c) => isSendableContact(c))) {
    return empty;
  }

  const domain = extractDomain(org.websiteUrl ?? org.domain);
  if (!domain) {
    return { ...empty, error: "Need a website/domain for Hunter." };
  }

  const parsed = EVENT_PARSED;
  let search = await searchHunterDomain({
    domain,
    limit: MAX_HUNTER_ROWS,
    type: "personal",
    jobTitles: parsed.jobTitles,
  });
  if (!search.ok) {
    return { ...empty, attempted: true, error: search.error };
  }

  let people = search.people;
  const hasEventRow = people.some(hunterRecordIsEventContact);
  if (!hasEventRow) {
    const generic = await searchHunterDomain({
      domain,
      limit: MAX_HUNTER_ROWS,
      type: "generic",
    });
    if (generic.ok) {
      people = [...people, ...generic.people];
    } else if (people.length === 0) {
      return { ...empty, attempted: true, hunterReturned: 0, error: generic.error };
    }
  }

  const matches = people.filter(hunterRecordIsEventContact).sort((a, b) => rankEventPerson(a) - rankEventPerson(b));
  const existingEmails = new Set(
    existing.map((c) => c.normalizedEmail ?? normalizeEmail(c.email)).filter((e): e is string => Boolean(e))
  );

  const added: Contact[] = [];
  let skippedExisting = 0;
  let skippedInvalid = 0;

  for (const person of matches) {
    if (added.length >= MAX_NEW_CONTACTS) break;
    const email = person.email.trim().toLowerCase();
    if (existingEmails.has(email)) {
      skippedExisting += 1;
      continue;
    }
    const already = await findExistingContact(org.id, email, null);
    if (already) {
      skippedExisting += 1;
      existingEmails.add(email);
      continue;
    }

    const generic = isGenericMailboxEmail(email);
    let verificationStatus: Contact["emailVerificationStatus"] = generic ? "valid_format" : "unverified";
    if (!generic) {
      const verified = await verifyEmailAddress(email);
      if (verified.status !== "verified_deliverable") {
        skippedInvalid += 1;
        continue;
      }
      verificationStatus = verified.status;
    }

    const contact = await createContact({
      organizationId: org.id,
      fullName: displayName(person),
      roleTitle: person.position ?? (generic ? "General event inbox" : null),
      roleCategory: person.department,
      email,
      phone: person.phone,
      linkedinUrl: person.linkedin,
      source: "ai_discovered",
      emailVerificationStatus: verificationStatus,
      importMetadata: {
        hunterQuery: EVENT_CONTACT_QUERY,
        hunterDomainSearch: true,
        hunterType: person.type,
        hunterConfidence: person.confidence,
        hunterDepartment: person.department,
        roleDescription: generic
          ? "General event / org inbox — a real doorway even when Hunter has no named person."
          : person.position
            ? `${person.position} — found via Hunter event-contact search.`
            : "Found via Hunter event-contact search.",
      },
    });
    existingEmails.add(email);
    added.push(contact);
  }

  return {
    attempted: true,
    hunterReturned: people.length,
    created: added.length,
    skippedExisting,
    skippedInvalid,
    error: search.error,
    contacts: added,
  };
}
