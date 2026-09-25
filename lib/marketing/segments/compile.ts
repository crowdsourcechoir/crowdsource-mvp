import type { SegmentDefinition } from "./definition";

export type CompiledSegment =
  | { ok: true; sql: string; values: string[] }
  | { ok: false; error: string };

const ATTRIBUTES = new Set(["city", "region", "country", "acquisition_source"]);

type LooseCondition = {
  type?: string;
  field?: string;
  op?: string;
  value?: string;
  topic?: string;
  status?: string;
};

function compileCondition(
  condition: LooseCondition,
  index: number
): { sql: string; value: string } | { error: string } {
  if (condition.type === "attribute") {
    if (!condition.field || !ATTRIBUTES.has(condition.field)) {
      return { error: `unsupported attribute ${condition.field ?? ""}` };
    }
    if (condition.op !== "eq") return { error: `unsupported op ${condition.op ?? ""}` };
    return {
      sql: `lower(coalesce(p.${condition.field}, '')) = lower($${index})`,
      value: condition.value ?? "",
    };
  }
  if (condition.type === "tag") {
    if (condition.op !== "has" && condition.op !== "eq") return { error: `unsupported op ${condition.op ?? ""}` };
    if (!condition.value?.trim()) return { error: "tag value is required" };
    return {
      sql: `exists (select 1 from public.person_tags t where t.person_id = p.id and t.tag = lower($${index}))`,
      value: condition.value,
    };
  }
  if (condition.type !== "subscription") return { error: `unsupported condition type ${condition.type ?? ""}` };
  if (condition.topic !== "marketing") return { error: `unsupported topic ${condition.topic ?? ""}` };
  if (condition.status !== "subscribed" && condition.status !== "unsubscribed" && condition.status !== "pending") {
    return { error: `unsupported subscription status ${condition.status ?? ""}` };
  }
  return {
    sql: `exists (select 1 from public.communication_subscriptions s where s.person_id = p.id and s.channel = 'email' and s.topic = 'marketing' and s.status = $${index})`,
    value: condition.status,
  };
}

/** JSON definition → parameterized SQL. Phase 1 accepts match "all" only. */
export function compileSegmentDefinition(raw: unknown, opts?: { sendableOnly?: boolean }): CompiledSegment {
  if (!raw || typeof raw !== "object") return { ok: false, error: "segment definition must be an object" };
  const definition = raw as Partial<SegmentDefinition> & { conditions?: unknown };
  if (definition.schemaVersion !== undefined && definition.schemaVersion !== 1) {
    return { ok: false, error: `Unknown segment schemaVersion: ${String(definition.schemaVersion)}` };
  }
  if (definition.match !== "all") return { ok: false, error: `segment match ${String(definition.match)} is not supported` };
  if (!Array.isArray(definition.conditions)) return { ok: false, error: "segment conditions must be an array" };
  if (definition.conditions.length === 0) {
    return { ok: true, sql: "select p.id from public.people p where false", values: [] };
  }

  const values: string[] = [];
  const clauses: string[] = [];
  for (const condition of definition.conditions) {
    if (!condition || typeof condition !== "object" || typeof (condition as { type?: unknown }).type !== "string") {
      return { ok: false, error: "unsupported condition type" };
    }
    const type = (condition as { type: string }).type;
    if (type !== "attribute" && type !== "tag" && type !== "subscription") {
      return { ok: false, error: `unsupported condition type ${type}` };
    }
    const compiled = compileCondition(condition as LooseCondition, values.length + 1);
    if ("error" in compiled) return { ok: false, error: compiled.error };
    values.push(compiled.value);
    clauses.push(compiled.sql);
  }

  let sql = `select p.id from public.people p where ${clauses.join(" and ")}`;
  if (opts?.sendableOnly) sql += " and public.email_marketing_eligible(p.id)";
  return { ok: true, sql, values };
}
