import {
  emailLocalPart,
  isGenericMailboxEmail,
  looksLikePersonName,
  normalizeEmail,
  normalizeOrgName,
} from "@/lib/sales/dedupe";

export type InboxPerson = {
  email: string;
  fullName: string | null;
  subjects: string[];
};

export type OrgMatchCandidate = {
  id: string;
  name: string;
  domains: string[];
};

export type OrgContactMatchHow = "domain" | "acronym" | "name" | "mention";

export type ProposedOrgContact = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  reason: string;
  prompt: string;
  matchHow: OrgContactMatchHow;
  sampleSubject: string | null;
};

const STOP_WORDS = new Set(["a", "an", "the", "of", "and", "for", "at", "in", "on", "to", "de", "du", "la", "le"]);

const FREE_OR_PLATFORM_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "hey.com",
  "fastmail.com",
  "linkedin.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "google.com",
  "youtube.com",
  "zoom.us",
  "calendly.com",
  "eventbrite.com",
  "mailchimp.com",
  "hubspot.com",
  "salesforce.com",
  "stripe.com",
  "paypal.com",
  "amazonses.com",
  "sendgrid.net",
  "constantcontact.com",
]);

const AUTOMATED_LOCAL =
  /^(noreply|no-reply|no_reply|donotreply|do-not-reply|notifications?|notify|mailer-daemon|postmaster|bounce|newsletter|newsletters|news|alerts?|daemon|automated|auto-reply|autoresponder|unsubscribe|mailer)$/i;

const MULTI_PART_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "com.au", "edu.au", "co.nz"]);

export function suggestionId(organizationId: string, email: string): string {
  return `${organizationId}:${email.trim().toLowerCase()}`;
}

export function emailHost(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const host = normalized.split("@")[1] ?? "";
  return host || null;
}

export function domainLabel(host: string): string {
  const parts = host.toLowerCase().split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const tail = parts.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(tail) && parts.length >= 3) return parts[parts.length - 3] ?? "";
  return parts[parts.length - 2] ?? "";
}

function significantWords(name: string): string[] {
  return normalizeOrgName(name)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function organizationAcronym(name: string): string {
  const words = significantWords(name);
  if (words.length < 2) return "";
  return words.map((word) => word[0]).join("");
}

function hostsRelated(emailHostValue: string, orgHost: string): boolean {
  return (
    emailHostValue === orgHost ||
    emailHostValue.endsWith(`.${orgHost}`) ||
    orgHost.endsWith(`.${emailHostValue}`)
  );
}

export function cleanDisplayName(name: string | null | undefined): string | null {
  if (!name) return null;
  const cut = name.split(/\s+[|–—]\s+|\s+-\s+/)[0]?.trim() ?? name.trim();
  if (!cut || cut.includes("@")) return null;
  return cut;
}

export function nameFromLocalPart(email: string): string | null {
  const local = emailLocalPart(email);
  if (!local || isGenericMailboxEmail(email)) return null;
  const bits = local.split(/[._-]+/).filter(Boolean);
  if (bits.length < 2 || bits.length > 4) return null;
  if (bits.some((bit) => bit.length < 2 || !/^[a-z]+$/i.test(bit))) return null;
  return bits.map((bit) => bit.charAt(0).toUpperCase() + bit.slice(1).toLowerCase()).join(" ");
}

function personName(person: InboxPerson): string | null {
  const cleaned = cleanDisplayName(person.fullName);
  if (cleaned && looksLikePersonName(cleaned)) return cleaned;
  const fromLocal = nameFromLocalPart(person.email);
  if (fromLocal && looksLikePersonName(fromLocal)) return fromLocal;
  return null;
}

function orgPhrase(name: string): string {
  const trimmed = name.trim();
  return /^the\b/i.test(trimmed) ? trimmed : `the ${trimmed}`;
}

function sameMailbox(a: string, b: string): boolean {
  const [leftLocal, leftHost] = a.split("@");
  const [rightLocal, rightHost] = b.split("@");
  if (!leftHost || !rightHost || leftHost !== rightHost) return false;
  return (leftLocal?.split("+")[0] ?? "") === (rightLocal?.split("+")[0] ?? "");
}

function contextText(person: InboxPerson): string {
  return normalizeOrgName(person.subjects.join(" "));
}

type Scored = {
  org: OrgMatchCandidate;
  score: number;
  how: OrgContactMatchHow;
  reason: string;
};

function scoreAgainstOrg(
  person: InboxPerson,
  host: string,
  label: string,
  text: string,
  org: OrgMatchCandidate,
  acronymOwners: Map<string, OrgMatchCandidate[]>
): Scored | null {
  const platform = FREE_OR_PLATFORM_DOMAINS.has(host);
  if (!platform) {
    const related = org.domains.find((domain) => hostsRelated(host, domain));
    if (related) {
      const child = host !== related;
      return {
        org,
        score: 100,
        how: "domain",
        reason: child
          ? `${person.email} is on ${host}, part of ${related} for ${org.name}.`
          : `${person.email} uses ${host}, the same domain on file for ${org.name}.`,
      };
    }
    const acronym = organizationAcronym(org.name);
    const owners = acronym.length >= 3 ? acronymOwners.get(acronym) ?? [] : [];
    const orgDomainLabelMatches = org.domains.some((domain) => domainLabel(domain) === label);
    if (label.length >= 3 && label === acronym && (owners.length === 1 || orgDomainLabelMatches)) {
      return {
        org,
        score: 60,
        how: "acronym",
        reason: `${person.email} matches the initials of ${org.name} (${acronym}).`,
      };
    }
    const words = significantWords(org.name);
    const firstTwo = words.slice(0, 2).join("");
    if (label.length >= 8 && firstTwo.startsWith(label)) {
      return {
        org,
        score: 70,
        how: "name",
        reason: `${person.email} uses ${label}, which lines up with ${org.name}.`,
      };
    }
  }
  const normalized = normalizeOrgName(org.name);
  if (normalized.length >= 12 && text.includes(normalized)) {
    return {
      org,
      score: 40,
      how: "mention",
      reason: `A thread with ${person.fullName?.trim() || person.email} mentions ${org.name}.`,
    };
  }
  return null;
}

export function proposeOrgContacts(input: {
  people: InboxPerson[];
  organizations: OrgMatchCandidate[];
  selfEmails?: string[];
  skipDomains?: string[];
  takenKeys?: Set<string>;
}): ProposedOrgContact[] {
  const selfEmails = (input.selfEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean);
  const skipDomains = new Set((input.skipDomains ?? []).map((domain) => domain.trim().toLowerCase()).filter(Boolean));
  const taken = input.takenKeys ?? new Set<string>();
  const organizations = input.organizations.filter((org) => org.name.trim());
  const acronymOwners = new Map<string, OrgMatchCandidate[]>();
  for (const org of organizations) {
    const acronym = organizationAcronym(org.name);
    if (acronym.length < 3) continue;
    const list = acronymOwners.get(acronym) ?? [];
    list.push(org);
    acronymOwners.set(acronym, list);
  }

  const proposed: ProposedOrgContact[] = [];
  const seen = new Set<string>();

  for (const person of input.people) {
    const email = normalizeEmail(person.email);
    if (!email) continue;
    if (selfEmails.some((self) => sameMailbox(email, self))) continue;
    const local = emailLocalPart(email);
    if (local && AUTOMATED_LOCAL.test(local)) continue;
    const host = emailHost(email);
    if (!host || skipDomains.has(host)) continue;
    const fullName = personName(person);
    if (!fullName) continue;

    const text = contextText(person);
    const label = domainLabel(host);
    const scored = organizations
      .map((org) => scoreAgainstOrg({ ...person, email, fullName }, host, label, text, org, acronymOwners))
      .filter((row): row is Scored => Boolean(row));
    if (!scored.length) continue;
    const best = Math.max(...scored.map((row) => row.score));
    let tied = scored.filter((row) => row.score === best);
    if (tied.length > 1) {
      const mentioned = tied.filter((row) => {
        const normalized = normalizeOrgName(row.org.name);
        return normalized.length >= 12 && text.includes(normalized);
      });
      if (mentioned.length === 1) tied = mentioned;
    }
    if (tied.length !== 1) continue;
    const winner = tied[0];
    const key = suggestionId(winner.org.id, email);
    if (taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    const sampleSubject = person.subjects.map((subject) => subject.trim()).find(Boolean) ?? null;
    proposed.push({
      id: key,
      organizationId: winner.org.id,
      organizationName: winner.org.name,
      email,
      fullName,
      reason: winner.reason.replace(person.email, email),
      prompt: `This looks like a person from ${orgPhrase(winner.org.name)}. Add ${fullName} (${email})?`,
      matchHow: winner.how,
      sampleSubject,
    });
  }

  return proposed;
}
