/** Pure consent decisions. Production writes go through Postgres; this module does not. */

export type SubscriptionStatus = "subscribed" | "unsubscribed" | "pending";

export type SuppressionReason = "unsubscribe" | "hard_bounce" | "complaint" | "manual";

export type RequestedAudienceStatus = "subscribed" | "unsubscribed" | "cleaned" | "pending";

export type ConsentSnapshot = {
  status: SubscriptionStatus;
  activeReasons: SuppressionReason[];
};

export type ConsentPlan = {
  status: SubscriptionStatus;
  ensure: SuppressionReason[];
  liftUnsubscribe: boolean;
  skippedReason?: string;
};

const HARD_BLOCK: SuppressionReason[] = ["hard_bounce", "complaint", "manual"];

function hardBlockReason(reasons: SuppressionReason[]): SuppressionReason | null {
  return HARD_BLOCK.find((reason) => reasons.includes(reason)) ?? null;
}

function isUnsubscribed(existing: ConsentSnapshot): boolean {
  return existing.status === "unsubscribed" || existing.activeReasons.includes("unsubscribe");
}

function keep(existing: ConsentSnapshot, skippedReason: string): ConsentPlan {
  return {
    status: existing.status,
    ensure: [],
    liftUnsubscribe: false,
    skippedReason,
  };
}

export function decideConsent(input: {
  requested: RequestedAudienceStatus;
  respectSuppression: boolean;
  existing: ConsentSnapshot | null;
}): ConsentPlan {
  const { requested, respectSuppression, existing } = input;

  if (!existing) {
    if (requested === "unsubscribed") {
      return { status: "unsubscribed", ensure: ["unsubscribe"], liftUnsubscribe: false };
    }
    if (requested === "cleaned") {
      return { status: "unsubscribed", ensure: ["hard_bounce"], liftUnsubscribe: false };
    }
    if (requested === "pending") {
      return { status: "pending", ensure: [], liftUnsubscribe: false };
    }
    return { status: "subscribed", ensure: [], liftUnsubscribe: false };
  }

  const blocked = hardBlockReason(existing.activeReasons);

  if (requested === "subscribed") {
    if (blocked === "hard_bounce") return keep(existing, "Preserved hard bounce");
    if (blocked === "complaint") return keep(existing, "Preserved complaint");
    if (blocked === "manual") return keep(existing, "Preserved manual suppression");
    if (isUnsubscribed(existing) && respectSuppression) {
      return keep(existing, "Preserved unsubscribed status");
    }
    if (isUnsubscribed(existing)) {
      return { status: "subscribed", ensure: [], liftUnsubscribe: true };
    }
    return { status: "subscribed", ensure: [], liftUnsubscribe: false };
  }

  if (requested === "cleaned") {
    return { status: "unsubscribed", ensure: ["hard_bounce"], liftUnsubscribe: false };
  }

  if (requested === "unsubscribed") {
    return { status: "unsubscribed", ensure: ["unsubscribe"], liftUnsubscribe: false };
  }

  if (blocked || (isUnsubscribed(existing) && respectSuppression)) {
    return keep(existing, blocked ? `Preserved ${blocked === "hard_bounce" ? "hard bounce" : blocked}` : "Preserved unsubscribed status");
  }
  return { status: "pending", ensure: [], liftUnsubscribe: false };
}

export type PresentedStatus = "subscribed" | "unsubscribed" | "cleaned" | "pending";

export function presentationStatus(snapshot: ConsentSnapshot | null): PresentedStatus {
  if (!snapshot) return "pending";
  if (snapshot.activeReasons.includes("hard_bounce")) return "cleaned";
  if (snapshot.status === "pending") return "pending";
  if (
    snapshot.status === "unsubscribed" ||
    snapshot.activeReasons.some((reason) => reason === "unsubscribe" || reason === "complaint" || reason === "manual")
  ) {
    return "unsubscribed";
  }
  if (snapshot.status === "subscribed") return "subscribed";
  return "pending";
}

/** Test double of public.email_marketing_eligible. The app calls the SQL function. */
export function isMarketingEligible(snapshot: ConsentSnapshot | null): boolean {
  if (!snapshot) return false;
  if (snapshot.status !== "subscribed") return false;
  if (snapshot.activeReasons.length > 0) return false;
  return true;
}

export function subscriptionEventSource(consentSource: string | null | undefined, acquisition: string | null | undefined): string {
  const value = (consentSource ?? acquisition ?? "admin").toLowerCase();
  if (value.includes("mailchimp")) return "mailchimp_import";
  if (value.includes("squarespace")) return "squarespace";
  if (value.includes("facebook")) return "facebook";
  if (value.includes("unsubscribe")) return "unsubscribe_link";
  if (value === "manual" || value === "admin") return "admin";
  return "api";
}

export function suppressionSourceFor(acquisition: string | null | undefined): "octo" | "mailchimp" {
  return acquisition === "mailchimp" ? "mailchimp" : "octo";
}
