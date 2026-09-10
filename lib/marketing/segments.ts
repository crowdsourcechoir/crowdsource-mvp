import type { MarketingPerson, MarketingSegment, SegmentRule } from "./types";

function ruleMatches(person: MarketingPerson, rule: SegmentRule): boolean {
  switch (rule.field) {
    case "status":
      return compareString(person.status, rule.op, rule.value);
    case "marketingConsent": {
      const want = rule.value === true || rule.value === "true";
      if (rule.op === "neq") return person.marketingConsent !== want;
      return person.marketingConsent === want;
    }
    case "city": {
      const city = (person.city ?? "").trim().toLowerCase();
      return compareString(city, rule.op, typeof rule.value === "string" ? rule.value.toLowerCase() : rule.value);
    }
    case "tag": {
      const tags = person.tags.map((t) => t.toLowerCase());
      if (rule.op === "in" && Array.isArray(rule.value)) {
        return rule.value.some((v) => tags.includes(String(v).toLowerCase()));
      }
      const needle = String(rule.value).toLowerCase();
      if (rule.op === "contains" || rule.op === "eq") return tags.includes(needle);
      if (rule.op === "neq") return !tags.includes(needle);
      return false;
    }
    case "acquisitionSource":
      return compareString(person.acquisitionSource, rule.op, rule.value);
    default:
      return false;
  }
}

function compareString(actual: string, op: SegmentRule["op"], value: SegmentRule["value"]): boolean {
  if (op === "in" && Array.isArray(value)) {
    return value.map(String).map((v) => v.toLowerCase()).includes(actual.toLowerCase());
  }
  const expected = String(value).toLowerCase();
  const left = actual.toLowerCase();
  if (op === "eq") return left === expected;
  if (op === "neq") return left !== expected;
  if (op === "contains") return left.includes(expected);
  return false;
}

/** People eligible for marketing sends: subscribed + consent + not suppressed. */
export function isSendable(person: MarketingPerson): boolean {
  if (person.status !== "subscribed") return false;
  if (!person.marketingConsent) return false;
  if (person.suppressedAt) return false;
  if (person.bounceClass === "hard") return false;
  return true;
}

export function personMatchesSegment(person: MarketingPerson, segment: MarketingSegment): boolean {
  if (segment.rules.length === 0) return false;
  return segment.rules.every((rule) => ruleMatches(person, rule));
}

export function evaluateSegment(
  people: MarketingPerson[],
  segment: MarketingSegment,
  opts?: { sendableOnly?: boolean }
): MarketingPerson[] {
  return people.filter((p) => {
    if (opts?.sendableOnly && !isSendable(p)) return false;
    return personMatchesSegment(p, segment);
  });
}

export function countSegment(
  people: MarketingPerson[],
  segment: MarketingSegment,
  opts?: { sendableOnly?: boolean }
): number {
  return evaluateSegment(people, segment, opts).length;
}
