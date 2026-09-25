import type { MarketingSegment, SegmentRule } from "../types";
import { compileSegmentDefinition } from "../segments/compile";
import type { SegmentDefinition } from "../segments/definition";
import { definitionToRules, rulesToDefinition } from "../segments/rules";
import { marketingDb } from "./client";
import { MarketingDbError, raiseDb } from "./errors";

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  definition: SegmentDefinition;
  created_at: string;
  updated_at: string;
};

function rowToSegment(row: SegmentRow): MarketingSegment {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules: definitionToRules(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSegments(): Promise<MarketingSegment[]> {
  const rows = await listSegmentRows();
  return rows.map(rowToSegment);
}

async function listSegmentRows(): Promise<SegmentRow[]> {
  const db = marketingDb();
  const { data, error } = await db.from("segments").select("*").order("created_at", { ascending: false });
  raiseDb(error);
  return (data ?? []) as SegmentRow[];
}

export async function listSegmentsWithCounts(): Promise<Array<MarketingSegment & { counts: { matched: number; sendable: number } }>> {
  const rows = await listSegmentRows();
  return Promise.all(
    rows.map(async (row) => {
      const counts = await segmentCounts(row.definition);
      return { ...rowToSegment(row), counts };
    })
  );
}

export async function segmentCounts(definition: SegmentDefinition): Promise<{ matched: number; sendable: number }> {
  const compiled = compileSegmentDefinition(definition);
  if (!compiled.ok) throw new MarketingDbError(compiled.error, 400);
  const db = marketingDb();
  const { data, error } = await db.rpc("marketing_segment_counts", { p_definition: definition });
  raiseDb(error);
  const counts = (data ?? {}) as { matched?: number; sendable?: number };
  return { matched: counts.matched ?? 0, sendable: counts.sendable ?? 0 };
}

export async function createSegment(input: {
  name: string;
  description?: string | null;
  rules: SegmentRule[];
}): Promise<MarketingSegment> {
  const converted = rulesToDefinition(input.rules);
  if (!converted.ok) throw new MarketingDbError(converted.error, 400);
  const db = marketingDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("segments")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      kind: "dynamic",
      definition: converted.definition,
      updated_at: now,
    })
    .select("*")
    .single();
  raiseDb(error);
  return rowToSegment(data as SegmentRow);
}

export async function updateSegment(input: {
  id: string;
  name?: string;
  description?: string | null;
  rules?: SegmentRule[];
}): Promise<MarketingSegment | null> {
  const db = marketingDb();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.name === "string") patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.rules) {
    const converted = rulesToDefinition(input.rules);
    if (!converted.ok) throw new MarketingDbError(converted.error, 400);
    patch.definition = converted.definition;
  }
  const { data, error } = await db.from("segments").update(patch).eq("id", input.id).select("*").maybeSingle();
  raiseDb(error);
  return data ? rowToSegment(data as SegmentRow) : null;
}

export async function deleteSegment(id: string): Promise<void> {
  const db = marketingDb();
  const { error } = await db.from("segments").delete().eq("id", id);
  raiseDb(error);
}
