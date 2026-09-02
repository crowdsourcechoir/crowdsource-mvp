/**
 * Turn a free-text “who to look for” prompt into Hunter Domain Search filters
 * plus local keyword matching (Hunter has no “events” department).
 */

export const HUNTER_DEPARTMENTS = [
  "executive",
  "it",
  "finance",
  "management",
  "sales",
  "legal",
  "support",
  "hr",
  "marketing",
  "communication",
  "education",
  "design",
  "health",
  "operations",
  "product",
  "research",
  "consulting",
  "administrative",
  "procurement",
] as const;

export type HunterDepartment = (typeof HUNTER_DEPARTMENTS)[number];
export type HunterSeniority = "junior" | "senior" | "executive";

export type ParsedFindQuery = {
  raw: string;
  /** Hunter `job_titles` (comma-delimited). */
  jobTitles: string[];
  departments: HunterDepartment[];
  seniority: HunterSeniority[];
  /** null = do not send the filter. */
  decisionMaker: boolean | null;
  /** Tokens used to score/filter returned positions locally. */
  keywords: string[];
};

const FILLER = new Set([
  "a",
  "an",
  "and",
  "any",
  "at",
  "contact",
  "contacts",
  "email",
  "emails",
  "find",
  "folks",
  "for",
  "hunter",
  "in",
  "look",
  "looking",
  "more",
  "new",
  "of",
  "on",
  "or",
  "people",
  "person",
  "please",
  "search",
  "someone",
  "staff",
  "team",
  "the",
  "their",
  "this",
  "those",
  "to",
  "who",
  "whose",
  "with",
]);

const DEPARTMENT_ALIASES: Record<string, HunterDepartment> = {
  admin: "administrative",
  administrative: "administrative",
  communications: "communication",
  communication: "communication",
  consulting: "consulting",
  creative: "design",
  design: "design",
  digital: "it",
  education: "education",
  executive: "executive",
  finance: "finance",
  health: "health",
  hr: "hr",
  it: "it",
  legal: "legal",
  leadership: "executive",
  management: "management",
  marketing: "marketing",
  operations: "operations",
  ops: "operations",
  people: "hr",
  pr: "communication",
  procurement: "procurement",
  product: "product",
  research: "research",
  sales: "sales",
  support: "support",
  talent: "hr",
  tech: "it",
  technology: "it",
};

const SENIORITY_ALIASES: Record<string, HunterSeniority> = {
  assistant: "junior",
  associate: "junior",
  ceo: "executive",
  cfo: "executive",
  chief: "executive",
  cio: "executive",
  cmo: "executive",
  coo: "executive",
  coordinator: "junior",
  director: "senior",
  executive: "executive",
  founder: "executive",
  head: "senior",
  junior: "junior",
  lead: "senior",
  manager: "senior",
  president: "executive",
  senior: "senior",
  vp: "executive",
};

/** Extra Hunter job-title terms for roles that are not Hunter departments. */
const JOB_TITLE_SYNONYMS: Record<string, string[]> = {
  advancement: ["advancement", "development", "fundraising"],
  development: ["development", "fundraising", "advancement"],
  event: ["event", "events", "gala", "programming"],
  events: ["events", "event", "gala", "programming"],
  fundraising: ["fundraising", "development", "advancement"],
  gala: ["gala", "events", "event", "fundraising"],
  hospitality: ["hospitality", "events", "event"],
  partnership: ["partnerships", "partnership", "business development"],
  partnerships: ["partnerships", "partnership", "business development"],
  programming: ["programming", "program", "events"],
};

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Parse operator text like "events team" or "director of development"
 * into Hunter Domain Search parameters.
 */
export function parseFindQuery(input: string): ParsedFindQuery {
  const raw = input.trim();
  const tokens = tokenize(raw);
  const content = tokens.filter((t) => !FILLER.has(t));

  const departments: HunterDepartment[] = [];
  const seniority: HunterSeniority[] = [];
  const jobTitles: string[] = [];
  const keywords: string[] = [];
  let decisionMaker: boolean | null = null;

  const joined = content.join(" ");
  if (/\bdecision makers?\b/.test(joined) || /\bbuying authority\b/.test(joined)) {
    decisionMaker = true;
  }

  if (/\bvice presidents?\b/.test(joined) || /\bc[ -]?suite\b/.test(joined)) {
    seniority.push("executive");
  }

  for (const token of content) {
    const dept = DEPARTMENT_ALIASES[token];
    if (dept) departments.push(dept);

    const sen = SENIORITY_ALIASES[token];
    if (sen) seniority.push(sen);
    if (token === "director" || token === "head") seniority.push("executive");

    const synonyms = JOB_TITLE_SYNONYMS[token];
    if (synonyms) jobTitles.push(...synonyms);
    else if (!dept && !sen && token.length > 1) jobTitles.push(token);

    if (token.length > 1) keywords.push(token);
    if (synonyms) keywords.push(...synonyms);
  }

  // "events" is not a Hunter department — keep it as job titles + keywords only.
  // Fundraising mapped to management is a weak proxy; still keep job titles.
  if (content.includes("fundraising") || content.includes("development") || content.includes("advancement")) {
    jobTitles.push("development", "fundraising", "advancement");
  }

  return {
    raw,
    jobTitles: uniq(jobTitles).slice(0, 8),
    departments: uniq(departments) as HunterDepartment[],
    seniority: uniq(seniority) as HunterSeniority[],
    decisionMaker,
    keywords: uniq(keywords),
  };
}

export type HunterPersonLike = {
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  department?: string | null;
  seniority?: string | null;
};

function haystack(person: HunterPersonLike): string {
  return [person.position, person.department, person.seniority, person.firstName, person.lastName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Local match after Hunter returns a page of people. If the query has no
 * content keywords, every named personal email is accepted.
 */
export function hunterPersonMatchesQuery(person: HunterPersonLike, parsed: ParsedFindQuery): boolean {
  if (parsed.keywords.length === 0) return true;
  const text = haystack(person);
  if (!text.trim()) return false;
  return parsed.keywords.some((kw) => {
    if (kw.length < 3) return new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(text);
    return text.includes(kw);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function describeFindQuery(parsed: ParsedFindQuery): string {
  if (!parsed.raw) return "named people at this domain";
  return parsed.raw;
}
