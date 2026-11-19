/**
 * Bookmarkable queue views — URL param presets, not a DB table.
 * Keeps one unified pipeline with named lenses for Joel's daily work.
 */

import type { QueueCashWindow } from "./cash-window";
import type { QueueScope } from "./scope";
import type { BusinessCategoryKey, DealTypeKey } from "../business-model";
import { HIGH_VALUE_POTENTIAL_USD } from "../business-model";

export type QueueSavedViewKey =
  | "pnw_sports_partners"
  | "commissioned_revenue"
  | "owned_entertainment"
  | "sponsorships"
  | "strategic_partners"
  | "follow_ups"
  | "high_value";

export type QueueSavedView = {
  key: QueueSavedViewKey;
  label: string;
  description: string;
  /** Query params applied when the view is selected (relative to current URL). */
  params: {
    scope?: QueueScope;
    business?: BusinessCategoryKey | "all";
    product?: string;
    deal?: DealTypeKey | "all";
    cash?: QueueCashWindow;
    value?: "all" | "high";
    workstream?: string;
    category?: string;
    funnel?: string;
    added?: string;
  };
};

export const QUEUE_SAVED_VIEWS: QueueSavedView[] = [
  {
    key: "pnw_sports_partners",
    label: "Seattle & PNW Sports",
    description: "To send email drafts led by Seattle & Pacific Northwest sports partner teams",
    params: { scope: "to_send", category: "sports", business: "all", deal: "all", value: "all", cash: "all" },
  },
  {
    key: "commissioned_revenue",
    label: "Commissioned Revenue",
    description: "Anthem, Fan Chant, Song Garden, custom activations",
    params: { business: "commissioned", deal: "all", value: "all", scope: "all", cash: "all" },
  },
  {
    key: "owned_entertainment",
    label: "Owned Entertainment",
    description: "Rave Choir and other owned Blooms",
    params: { business: "owned", deal: "all", value: "all", scope: "all", cash: "all" },
  },
  {
    key: "sponsorships",
    label: "Sponsorships",
    description: "Deals structured as sponsorships",
    params: { deal: "sponsorship", business: "all", value: "all", scope: "all", cash: "all" },
  },
  {
    key: "strategic_partners",
    label: "Strategic Partners",
    description: "Strategic partnership opportunities",
    params: { deal: "strategic_partnership", business: "all", value: "all", scope: "all", cash: "all" },
  },
  {
    key: "follow_ups",
    label: "Follow-ups",
    description: "Due follow-ups in the unified queue",
    params: { scope: "due", business: "all", deal: "all", value: "all", cash: "all" },
  },
  {
    key: "high_value",
    label: "High-Value Opportunities",
    description: `Potential deal ≥ $${HIGH_VALUE_POTENTIAL_USD.toLocaleString("en-US")}`,
    params: { value: "high", scope: "all", business: "all", deal: "all", cash: "all" },
  },
];

export function parseQueueSavedView(raw: string | null | undefined): QueueSavedViewKey | null {
  if (!raw) return null;
  return QUEUE_SAVED_VIEWS.some((v) => v.key === raw) ? (raw as QueueSavedViewKey) : null;
}

export function savedViewByKey(key: QueueSavedViewKey): QueueSavedView {
  return QUEUE_SAVED_VIEWS.find((v) => v.key === key)!;
}

/** Detect which saved view (if any) matches the current filter combo. */
export function matchingSavedView(filters: {
  scope: string;
  business: string;
  deal: string;
  value: string;
  cash: string;
  category?: string;
}): QueueSavedViewKey | null {
  const cashNorm = filters.cash === "now" ? "cash_now" : filters.cash;
  for (const view of QUEUE_SAVED_VIEWS) {
    const p = view.params;
    if (view.key === "pnw_sports_partners") {
      if (
        filters.scope === "to_send" &&
        filters.category === "sports" &&
        filters.business === "all" &&
        filters.deal === "all" &&
        filters.value === "all" &&
        cashNorm === "all"
      ) {
        return "pnw_sports_partners";
      }
      continue;
    }
    if (view.key === "follow_ups") {
      if (
        filters.scope === "due" &&
        filters.business === "all" &&
        filters.deal === "all" &&
        filters.value === "all"
      ) {
        return "follow_ups";
      }
      continue;
    }
    const expectedScope = p.scope ?? "all";
    const scopeOk =
      expectedScope === "all"
        ? filters.scope === "all"
        : filters.scope === expectedScope;
    const businessOk = (p.business ?? "all") === filters.business;
    const dealOk = (p.deal ?? "all") === filters.deal;
    const valueOk = (p.value ?? "all") === filters.value;
    const expectedCash = p.cash ?? "all";
    const cashOk = expectedCash === cashNorm;
    if (scopeOk && businessOk && dealOk && valueOk && cashOk) return view.key;
  }
  return null;
}
