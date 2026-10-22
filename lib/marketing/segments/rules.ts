import type { SegmentRule } from "../types";
import type { SegmentCondition, SegmentDefinition } from "./definition";
import { compileSegmentDefinition } from "./compile";

type SubscriptionStatus = "subscribed" | "unsubscribed" | "pending";

function subscription(status: SubscriptionStatus): SegmentCondition {
  return { type: "subscription", topic: "marketing", status };
}

export function rulesToDefinition(rules: SegmentRule[]): { ok: true; definition: SegmentDefinition } | { ok: false; error: string } {
  const conditions: SegmentCondition[] = [];
  let subscriptionStatus: SubscriptionStatus | null = null;

  const setSubscription = (status: SubscriptionStatus): string | null => {
    if (subscriptionStatus && subscriptionStatus !== status) {
      return "Segment rules disagree about subscription status";
    }
    subscriptionStatus = status;
    return null;
  };

  for (const rule of rules) {
    if (rule.op === "neq" || rule.op === "in") {
      return { ok: false, error: `unsupported op ${rule.op}` };
    }
    if (rule.field === "status") {
      const value = String(rule.value);
      if (value === "cleaned") return { ok: false, error: "status cleaned is not a segment condition yet" };
      if (value !== "subscribed" && value !== "unsubscribed" && value !== "pending") {
        return { ok: false, error: `unsupported status ${value}` };
      }
      if (rule.op !== "eq") return { ok: false, error: `unsupported op ${rule.op}` };
      const conflict = setSubscription(value);
      if (conflict) return { ok: false, error: conflict };
      continue;
    }
    if (rule.field === "marketingConsent") {
      const want = rule.value === true || rule.value === "true";
      if (rule.op !== "eq") return { ok: false, error: `unsupported op ${rule.op}` };
      const conflict = setSubscription(want ? "subscribed" : "unsubscribed");
      if (conflict) return { ok: false, error: conflict };
      continue;
    }
    if (rule.field === "city" || rule.field === "region" || rule.field === "country") {
      if (rule.op !== "eq") return { ok: false, error: `unsupported op ${rule.op}` };
      conditions.push({ type: "attribute", field: rule.field, op: "eq", value: String(rule.value) });
      continue;
    }
    if (rule.field === "acquisitionSource") {
      if (rule.op !== "eq") return { ok: false, error: `unsupported op ${rule.op}` };
      conditions.push({ type: "attribute", field: "acquisition_source", op: "eq", value: String(rule.value) });
      continue;
    }
    if (rule.field === "tag") {
      if (rule.op !== "eq" && rule.op !== "contains") return { ok: false, error: `unsupported op ${rule.op}` };
      conditions.push({ type: "tag", op: "has", value: String(rule.value) });
      continue;
    }
    return { ok: false, error: `unsupported field ${String(rule.field)}` };
  }

  if (subscriptionStatus) conditions.unshift(subscription(subscriptionStatus));
  const definition: SegmentDefinition = { schemaVersion: 1, match: "all", conditions };
  const compiled = compileSegmentDefinition(definition);
  if (!compiled.ok) return compiled;
  return { ok: true, definition };
}

export function definitionToRules(definition: SegmentDefinition): SegmentRule[] {
  const rules: SegmentRule[] = [];
  for (const condition of definition.conditions) {
    if (condition.type === "subscription") {
      if (condition.status === "subscribed") {
        rules.push({ field: "status", op: "eq", value: "subscribed" });
        rules.push({ field: "marketingConsent", op: "eq", value: true });
      } else if (condition.status === "unsubscribed") {
        rules.push({ field: "status", op: "eq", value: "unsubscribed" });
        rules.push({ field: "marketingConsent", op: "eq", value: false });
      } else {
        rules.push({ field: "status", op: "eq", value: "pending" });
      }
      continue;
    }
    if (condition.type === "tag") {
      rules.push({ field: "tag", op: "eq", value: condition.value });
      continue;
    }
    if (condition.field === "acquisition_source") {
      rules.push({ field: "acquisitionSource", op: "eq", value: condition.value });
      continue;
    }
    rules.push({ field: condition.field, op: "eq", value: condition.value });
  }
  return rules;
}
