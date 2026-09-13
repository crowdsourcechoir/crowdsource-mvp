/**
 * Soft prospecting gate stored on organizations.import_metadata — no migration required.
 * Used to hide state/regional associations from the queue and block further pipeline/Hunter spend
 * while keeping the organization row.
 */

export const DO_NOT_PROSPECT_REASON_STATE_ASSOC = "state_or_regional_association";

export type DoNotProspectMeta = {
  doNotProspect: true;
  doNotProspectReason: string;
  doNotProspectAt: string;
};

const US_STATES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";

const STATE_ASSOC_RE = new RegExp(
  [
    // "Oregon Library Association", "Washington State Hospital Association"
    `\\b(${US_STATES})\\b.{0,50}\\b(Association|Society|Council|Federation|Coalition)\\b`,
    // "Hospital Association of New York State"
    `\\b(Association|Society|Council|Federation)\\b.{0,40}\\bof\\s+(${US_STATES})\\b`,
    // "Michigan Society of Association Executives"
    `\\b(${US_STATES})\\s+Society\\s+of\\s+Association\\s+Executives\\b`,
    // "Council of Michigan Foundations"
    `\\bCouncil\\s+of\\s+(${US_STATES})\\b`,
    // Explicit state/regional chapter language
    `\\b(State|Regional|County)\\b.{0,40}\\b(Association|Society|Council)\\b`,
  ].join("|"),
  "i"
);

/** Clear national brands that can contain a state word (e.g. "Washington" in a title) but are not state chapters. */
const NATIONAL_ALLOWLIST_RE =
  /\b(National|American|United\s+States|U\.S\.|USA|International|World)\b/i;

export function isDoNotProspect(importMetadata: Record<string, unknown> | null | undefined): boolean {
  return Boolean(importMetadata && importMetadata.doNotProspect === true);
}

export function withDoNotProspect(
  importMetadata: Record<string, unknown> | null | undefined,
  reason: string,
  at: string = new Date().toISOString()
): Record<string, unknown> & DoNotProspectMeta {
  return {
    ...(importMetadata ?? {}),
    doNotProspect: true,
    doNotProspectReason: reason,
    doNotProspectAt: at,
  };
}

/**
 * Heuristic: state / regional membership orgs (hospital, library, SAE, nurses, etc.).
 * Nationals that lead with National/American/… are kept even if a state word appears later.
 */
export function looksLikeStateOrRegionalAssociation(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (NATIONAL_ALLOWLIST_RE.test(trimmed) && !/\bState\s+(Hospital|Library|Nurses|Nursing|Bar)\b/i.test(trimmed)) {
    // "National …" / "American …" stay; still catch "Alaska State Hospital…"
    if (!STATE_ASSOC_RE.test(trimmed)) return false;
    // National allowlist wins unless it's clearly "X State Hospital/Library…"
    if (!/\b(State\s+Hospital|State\s+Library|State\s+Nurses|State\s+Nursing|State\s+Bar)\b/i.test(trimmed)) {
      return false;
    }
  }
  return STATE_ASSOC_RE.test(trimmed);
}

/** True when any opportunity shows real outbound / inbound / Gmail thread (not merely queued). */
export function organizationHasBeenContacted(
  opportunities: Array<{
    lastOutboundAt?: string | null;
    lastInboundAt?: string | null;
    gmailThreadId?: string | null;
  }>
): boolean {
  return opportunities.some(
    (o) => Boolean(o.lastOutboundAt) || Boolean(o.lastInboundAt) || Boolean(o.gmailThreadId)
  );
}
