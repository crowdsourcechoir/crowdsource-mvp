/**
 * Platform V2 community spine — types.
 * Song Garden is a modality on this spine; do not conflate with WorldJourney UX.
 */

export type IdentityMode = "open" | "account_required";

export type ContributionRights = {
  /** May appear in public Garden discovery / in-Garden credit. */
  publicDisplay: boolean;
  /** May be used in live show / gameday. */
  showUse: boolean;
  /** May appear in sponsor / campaign packages. */
  sponsorUse: boolean;
  /** May be used in social / credit-pack exports. */
  socialPosting: boolean;
};

export const DEFAULT_CONTRIBUTION_RIGHTS: ContributionRights = {
  publicDisplay: true,
  showUse: true,
  sponsorUse: false,
  socialPosting: true,
};

export type CommunitySettings = {
  identityMode: IdentityMode;
  /**
   * Denominator for Participation rate (manual for Populus pilot until ticketing hooks).
   * Null → Index returns null rate with reason.
   */
  reachableAudience: number | null;
  /** Optional campaign / sponsor window label for Index packaging. */
  campaignLabel: string | null;
  /** ISO start of sponsored window; null = all-time garden. */
  campaignWindowStart: string | null;
  /** ISO end of sponsored window; null = open-ended. */
  campaignWindowEnd: string | null;
  /** Soft flag for Populus pilot gardens. */
  populusPilot: boolean;
};

export const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
  identityMode: "open",
  reachableAudience: null,
  campaignLabel: null,
  campaignWindowStart: null,
  campaignWindowEnd: null,
  populusPilot: false,
};

export type ParticipantIdentity = {
  id: string;
  gardenId: string;
  deviceId: string;
  displayName: string | null;
  email: string | null;
  /** true once displayName+email claimed (satisfies account_required). */
  claimed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContributionNodeRef = {
  sourceType: "clip" | "turn" | "pulse";
  sourceId: string;
};

export type ContributionNode = ContributionNodeRef & {
  id: string;
  gardenId: string;
  chapterId: string | null;
  bloomEventId: string | null;
  deviceId: string | null;
  kind: string;
  rights: ContributionRights;
  /** Composer seam — selected for culture / performance. */
  selected: boolean;
  /** Live seam — marked performed in a Bloom. */
  performed: boolean;
  creditName: string | null;
  excerpt: string | null;
  reactCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RecognitionKind = "selected" | "performed" | "amplified";

export type RecognitionEvent = {
  id: string;
  gardenId: string;
  kind: RecognitionKind;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  actorDeviceId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ContributionReact = {
  id: string;
  gardenId: string;
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  deviceId: string;
  reaction: "heart";
  createdAt: string;
};

export type CreditPackEntry = {
  sourceType: ContributionNode["sourceType"];
  sourceId: string;
  creditName: string;
  kind: string;
  selected: boolean;
  performed: boolean;
  reactCount: number;
  rights: ContributionRights;
  recognition: RecognitionKind[];
  excerpt: string | null;
};

export type CreditPack = {
  gardenId: string;
  gardenSlug: string;
  gardenTitle: string;
  generatedAt: string;
  campaignLabel: string | null;
  entries: CreditPackEntry[];
};

export type ParticipationIndex = {
  gardenId: string;
  gardenSlug: string;
  campaignLabel: string | null;
  window: { start: string | null; end: string | null };
  /** contributors ÷ reachableAudience (null if audience unknown). */
  participationRate: number | null;
  contributors: number;
  reachableAudience: number | null;
  /** contributions + reacts in window. */
  sponsoredParticipationVolume: number;
  contributionsInWindow: number;
  reactsInWindow: number;
  /**
   * People who performed/encountered resulting piece with credit path back.
   * v0: distinct devices on performed contributions + performers' credit names.
   */
  activationReach: number;
  notes: string[];
};

export function normalizeCommunitySettings(
  input: Partial<CommunitySettings> | null | undefined
): CommunitySettings {
  const identityMode =
    input?.identityMode === "account_required" ? "account_required" : "open";
  const reachable =
    typeof input?.reachableAudience === "number" &&
    Number.isFinite(input.reachableAudience) &&
    input.reachableAudience > 0
      ? Math.floor(input.reachableAudience)
      : null;
  return {
    identityMode,
    reachableAudience: reachable,
    campaignLabel:
      typeof input?.campaignLabel === "string" && input.campaignLabel.trim()
        ? input.campaignLabel.trim()
        : null,
    campaignWindowStart:
      typeof input?.campaignWindowStart === "string" && input.campaignWindowStart.trim()
        ? input.campaignWindowStart.trim()
        : null,
    campaignWindowEnd:
      typeof input?.campaignWindowEnd === "string" && input.campaignWindowEnd.trim()
        ? input.campaignWindowEnd.trim()
        : null,
    populusPilot: input?.populusPilot === true,
  };
}

export function normalizeContributionRights(
  input: Partial<ContributionRights> | null | undefined
): ContributionRights {
  return {
    publicDisplay: input?.publicDisplay !== false,
    showUse: input?.showUse !== false,
    sponsorUse: input?.sponsorUse === true,
    socialPosting: input?.socialPosting !== false,
  };
}

/** Account-required: claimed identity. Open: always allowed. */
export function canParticipate(
  settings: CommunitySettings,
  identity: ParticipantIdentity | null
): { ok: boolean; reason?: string } {
  if (settings.identityMode === "open") return { ok: true };
  if (identity?.claimed && identity.displayName?.trim() && identity.email?.trim()) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: "This Garden requires a claimed identity before you contribute or react.",
  };
}
