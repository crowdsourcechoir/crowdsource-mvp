import type { HunterDepartment, HunterSeniority } from "./find-query";

const HUNTER_DOMAIN_SEARCH_URL = "https://api.hunter.io/v2/domain-search";
const FETCH_TIMEOUT_MS = 15000;

export type HunterDomainSearchPerson = {
  email: string;
  type: "personal" | "generic" | string | null;
  confidence: number | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  linkedin: string | null;
  phone: string | null;
  verificationStatus: string | null;
};

export type HunterDomainSearchInput = {
  domain: string;
  limit?: number;
  offset?: number;
  type?: "personal" | "generic";
  departments?: HunterDepartment[];
  seniority?: HunterSeniority[];
  jobTitles?: string[];
  requiredFields?: Array<"full_name" | "position" | "phone_number">;
  decisionMaker?: boolean | null;
};

export type HunterDomainSearchResult = {
  ok: boolean;
  people: HunterDomainSearchPerson[];
  results: number;
  error: string | null;
  httpStatus: number | null;
};

function mapPerson(raw: Record<string, unknown>): HunterDomainSearchPerson | null {
  const email = typeof raw.value === "string" ? raw.value.trim().toLowerCase() : "";
  if (!email) return null;
  const firstName = typeof raw.first_name === "string" ? raw.first_name.trim() : null;
  const lastName = typeof raw.last_name === "string" ? raw.last_name.trim() : null;
  const verification =
    raw.verification && typeof raw.verification === "object"
      ? (raw.verification as { status?: unknown }).status
      : null;
  return {
    email,
    type: typeof raw.type === "string" ? raw.type : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    firstName: firstName || null,
    lastName: lastName || null,
    position: typeof raw.position === "string" ? raw.position.trim() || null : null,
    seniority: typeof raw.seniority === "string" ? raw.seniority : null,
    department: typeof raw.department === "string" ? raw.department : null,
    linkedin: typeof raw.linkedin === "string" ? raw.linkedin : null,
    phone: typeof raw.phone_number === "string" ? raw.phone_number : null,
    verificationStatus: typeof verification === "string" ? verification : null,
  };
}

/**
 * Hunter.io Domain Search — 1 credit per 1–10 emails returned for the domain.
 * Returns named people + emails in one call (unlike Email Finder, which needs a name).
 */
export async function searchHunterDomain(input: HunterDomainSearchInput): Promise<HunterDomainSearchResult> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, people: [], results: 0, error: "HUNTER_API_KEY is missing.", httpStatus: null };
  }

  const domain = input.domain.trim().toLowerCase().replace(/^www\./, "");
  if (!domain) {
    return { ok: false, people: [], results: 0, error: "Need a website/domain for Hunter.", httpStatus: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url = new URL(HUNTER_DOMAIN_SEARCH_URL);
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", String(Math.min(100, Math.max(1, input.limit ?? 10))));
    if (input.offset && input.offset > 0) url.searchParams.set("offset", String(input.offset));
    if (input.type) url.searchParams.set("type", input.type);
    if (input.departments?.length) url.searchParams.set("department", input.departments.join(","));
    if (input.seniority?.length) url.searchParams.set("seniority", input.seniority.join(","));
    if (input.jobTitles?.length) url.searchParams.set("job_titles", input.jobTitles.join(","));
    if (input.requiredFields?.length) url.searchParams.set("required_field", input.requiredFields.join(","));
    if (input.decisionMaker === true) url.searchParams.set("decision_maker", "true");
    if (input.decisionMaker === false) url.searchParams.set("decision_maker", "false");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        ok: false,
        people: [],
        results: 0,
        error: `Hunter HTTP ${res.status}`,
        httpStatus: res.status,
      };
    }

    const body = (await res.json()) as {
      data?: { emails?: Record<string, unknown>[] };
      meta?: { results?: number };
    };
    const people = (body.data?.emails ?? []).map(mapPerson).filter((p): p is HunterDomainSearchPerson => Boolean(p));
    return {
      ok: true,
      people,
      results: body.meta?.results ?? people.length,
      error: null,
      httpStatus: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      people: [],
      results: 0,
      error: err instanceof Error ? err.message : "Hunter domain search failed",
      httpStatus: null,
    };
  }
}
