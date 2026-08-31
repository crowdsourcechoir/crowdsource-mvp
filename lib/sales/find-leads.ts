export const CONTACT_ROLE_PRESETS = [
  { id: "fan_engagement", label: "Fan engagement", hint: "fan engagement marketing brand experience" },
  { id: "marketing", label: "Marketing / communications", hint: "marketing communications brand PR" },
  { id: "athletic_director", label: "Athletic director", hint: "athletic director athletics" },
  { id: "conference", label: "Conference / events", hint: "conference events programming meeting planner" },
] as const;

export type FindLeadsAction = "contact" | "similar" | "discover" | "fill_queue";

export type ParsedFindIntent = {
  action: FindLeadsAction;
  organizationName: string | null;
  roleHint: string | null;
  count: number;
  focus: string | null;
};

const DEFAULT_COUNT = 10;

function clampCount(n: number): number {
  if (!Number.isFinite(n) || n < 1) return DEFAULT_COUNT;
  return Math.min(25, Math.floor(n));
}

function matchRoleHint(text: string): string | null {
  const lower = text.toLowerCase();
  if (/fan[\s-]?engagement|game[\s-]?entertainment|brand experience/.test(lower)) {
    return CONTACT_ROLE_PRESETS[0].hint;
  }
  if (/athletic director|\bad\b|athletics (director|dept|department)/.test(lower)) {
    return CONTACT_ROLE_PRESETS[2].hint;
  }
  if (/marketing|communications|comms|\bpr\b|public relations/.test(lower)) {
    return CONTACT_ROLE_PRESETS[1].hint;
  }
  if (/conference|event planner|meeting planner|programming director/.test(lower)) {
    return CONTACT_ROLE_PRESETS[3].hint;
  }
  const person = lower.match(/(?:find|get|who is|look(?:ing)? for)\s+(?:the\s+)?(.+?)\s+(?:person|contact|lead|director)(?:\s+at|\s+for|\s+with)?/i);
  if (person?.[1] && person[1].trim().length >= 3) return person[1].trim();
  return null;
}

function orgNameFromText(text: string): string | null {
  const at = text.match(/\bat\s+(.+?)\s*$/i) ?? text.match(/\bfor\s+(.+?)\s*$/i);
  if (!at?.[1]) return null;
  const name = at[1].replace(/\b(this org(?:anization)?|them|it)\b/gi, "").trim();
  return name.length >= 2 ? name : null;
}

/**
 * Turns a one-line ask into a structured find-leads action.
 * "this org" / missing name is filled by the selected search context in the UI.
 */
export function parseFindIntent(text: string): ParsedFindIntent {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const countMatch = lower.match(/\b(\d+)\s+(more|similar|equivalent|like|new|leads?|orgs?)\b/);
  const count = countMatch ? clampCount(Number(countMatch[1])) : DEFAULT_COUNT;

  if (/\bfill (the )?queue\b|\bstuck\b|\bblocked leads?\b/.test(lower)) {
    return { action: "fill_queue", organizationName: null, roleHint: null, count, focus: null };
  }

  const similar =
    /\b(more|similar|equivalent|like this|like that|peers?|comparables?)\b/.test(lower) &&
    !/\bperson\b|\bcontact\b|\bwho\b/.test(lower);
  if (similar || /\b(\d+)\s+more\b/.test(lower)) {
    return {
      action: "similar",
      organizationName: orgNameFromText(raw),
      roleHint: matchRoleHint(raw),
      count,
      focus: null,
    };
  }

  const roleHint = matchRoleHint(raw);
  if (roleHint || /\b(person|contact|who (?:is|handles)|staff)\b/.test(lower)) {
    return {
      action: "contact",
      organizationName: orgNameFromText(raw),
      roleHint: roleHint ?? CONTACT_ROLE_PRESETS[0].hint,
      count: 1,
      focus: null,
    };
  }

  return {
    action: "discover",
    organizationName: orgNameFromText(raw),
    roleHint: null,
    count,
    focus: raw || null,
  };
}

export function similarFocusForOrg(input: {
  name: string;
  typeLabel: string | null;
  city: string | null;
  region: string | null;
  roleHint?: string | null;
}): string {
  const type = input.typeLabel?.trim() || "organization";
  const where = [input.city, input.region].filter(Boolean).join(", ");
  const role = input.roleHint?.trim();
  const roleBit = role ? ` — ${role}` : "";
  return `${type}s like ${input.name}${where ? ` in ${where}` : ""} annual conference fan experience${roleBit}`;
}

export function findMoreLikeRoleHref(orgId: string, role: string): string {
  const params = new URLSearchParams({
    find: "similar",
    orgId,
    role,
  });
  return `/admin/sales/organizations?${params.toString()}`;
}

export function contactRoleRank(roleTitle: string | null | undefined, roleHint: string | null | undefined): number {
  if (!roleHint?.trim() || !roleTitle) return 0;
  const title = roleTitle.toLowerCase();
  const needles = roleHint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  return needles.reduce((sum, word) => (title.includes(word) ? sum + 1 : sum), 0);
}
