/**
 * Buyer-persona classification for a contact's role, distinct from `contacts.role_category`
 * (a free-text department bucket imported verbatim from CSV, e.g. "Marketing/Fan Engagement").
 * This is a small, controlled taxonomy purpose-built for choosing an outreach strategy: who
 * this person is decides what we're asking them for, not just how we personalize the email.
 *
 * Deterministic keyword matching on `role_title`, not an LLM call — cheap, instant, and fully
 * auditable (a human can see exactly why a title landed in a bucket). Deliberately conservative:
 * most real-world titles we've seen (COO, "Director of Accreditation", "Chief Business
 * Development Officer") don't confidently match any of the five buyer personas below, so they
 * fall to "other" and get today's original generic ask rather than a wrong guess.
 */
export type OutreachPersona = "executive_director" | "events_director" | "program_manager" | "board_member" | "conference_planner" | "other";

export type PersonaStrategy = {
  label: string;
  primaryGoal: string;
  cta: string;
};

/**
 * CTA phrasing mirrors Joel's real outreach voice — consistently a soft "If it feels like it
 * could be a fit, I'd love to ___" close, never a pushy or presumptive ask. Only the ___ varies
 * by persona/goal (see docs/sales-platform/ai-workflow.md §8 for the voice-reference emails these
 * are modeled on). Keep new personas' CTAs in this same shape rather than inventing a different
 * closing pattern per role.
 */
export const PERSONA_STRATEGIES: Record<OutreachPersona, PersonaStrategy> = {
  executive_director: {
    label: "Executive Director / CEO",
    primaryGoal: "Earn sponsorship and referral",
    cta: "If it feels like it could be a fit, I'd love to connect — or if there's someone else on your team who leads conference programming, I'd welcome an introduction.",
  },
  events_director: {
    label: "Events Director",
    primaryGoal: "Explore fit",
    cta: "If it feels like it could be a fit, I'd love to schedule a quick call and learn more about the event.",
  },
  program_manager: {
    label: "Program Manager",
    primaryGoal: "Evaluate session",
    cta: "If it feels like it could be a fit, I'd love to send over more detail so you can see whether it works for a session.",
  },
  board_member: {
    label: "Board Member",
    primaryGoal: "Champion internally",
    cta: "If it feels like it could be a fit, I'd love an introduction to whoever on staff leads event programming.",
  },
  conference_planner: {
    label: "Conference Planner",
    primaryGoal: "Buy",
    cta: "If it feels like it could be a fit, I'd love to schedule a quick call to talk through programming and budget.",
  },
  other: {
    label: "Unclassified role",
    primaryGoal: "Explore fit",
    cta: "If it feels like it could be a fit, I'd love to schedule a quick call and learn more.",
  },
};

const PERSONA_KEYWORD_RULES: { persona: OutreachPersona; patterns: RegExp[] }[] = [
  {
    persona: "executive_director",
    patterns: [/\bceo\b/i, /\bexecutive director\b/i, /\bpresident\b/i, /\bchief executive\b/i, /\bsuperintendent\b/i, /\bfounder\b/i],
  },
  {
    persona: "conference_planner",
    patterns: [/\bconference (planner|coordinator|manager)\b/i, /\bmeeting planner\b/i, /\bevent(s)? planner\b/i],
  },
  {
    persona: "events_director",
    patterns: [/\bdirector of events?\b/i, /\bevents? director\b/i, /\bhead of events?\b/i, /\bvp of events?\b/i],
  },
  {
    persona: "program_manager",
    patterns: [/\bprogram (manager|director|coordinator)\b/i, /\bprogramming (manager|director)\b/i, /\bsession (chair|coordinator)\b/i],
  },
  {
    persona: "board_member",
    patterns: [/\bboard member\b/i, /\btrustee\b/i, /\bboard of directors\b/i, /\bboard chair\b/i],
  },
];

export function classifyOutreachPersona(roleTitle: string | null | undefined): OutreachPersona {
  if (!roleTitle) return "other";
  for (const rule of PERSONA_KEYWORD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(roleTitle))) return rule.persona;
  }
  return "other";
}
