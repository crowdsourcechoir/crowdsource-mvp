import type { SupabaseClient } from "@supabase/supabase-js";
import { assembleEventMemoryRecord } from "@/lib/memory/assemble-record";
import type { EventMemoryRecord, FinalizeMemoryOptions } from "@/lib/memory/types";
import { localGetLatestMemoryForEvent, localUpsertMemoryRecord } from "@/lib/local-memory-store";
import { supabaseAdmin } from "@/lib/supabase-server";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

async function nextVersion(db: SupabaseClient, eventId: string): Promise<number> {
  const { data, error } = await db
    .from("event_memory_records")
    .select("version")
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const prior = typeof data?.version === "number" ? data.version : 0;
  return prior + 1;
}

export async function finalizeEventMemory(
  options: FinalizeMemoryOptions,
  db: SupabaseClient | null = supabaseAdmin
): Promise<EventMemoryRecord> {
  const { eventId, finalizedBy = "joel" } = options;
  const assembled = await assembleEventMemoryRecord({ eventId }, db);

  const record: EventMemoryRecord = {
    ...assembled,
    finalizedBy,
    finalizedAt: new Date().toISOString(),
  };

  if (USE_LOCAL_EVENTS || eventId.startsWith("local-")) {
    return localUpsertMemoryRecord(record);
  }

  if (!db) {
    throw new Error("Database not configured.");
  }

  const version = await nextVersion(db, eventId);
  const row = {
    event_id: eventId,
    payload: { ...record, version },
    finalized_at: record.finalizedAt,
    finalized_by: finalizedBy,
    version,
  };

  const { data, error } = await db
    .from("event_memory_records")
    .insert(row)
    .select("id, payload, finalized_at, finalized_by, version")
    .single();

  if (error) throw new Error(error.message);

  return {
    ...(data.payload as EventMemoryRecord),
    id: data.id as string,
    finalizedAt: data.finalized_at as string,
    finalizedBy: data.finalized_by as EventMemoryRecord["finalizedBy"],
    version: data.version as number,
  };
}

export async function getLatestEventMemory(
  eventId: string,
  db: SupabaseClient | null = supabaseAdmin
): Promise<EventMemoryRecord | null> {
  if (USE_LOCAL_EVENTS || eventId.startsWith("local-")) {
    return localGetLatestMemoryForEvent(eventId);
  }

  if (!db) return null;

  const { data, error } = await db
    .from("event_memory_records")
    .select("id, payload, finalized_at, finalized_by, version")
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.payload) return null;

  return {
    ...(data.payload as EventMemoryRecord),
    id: data.id as string,
    finalizedAt: data.finalized_at as string,
    finalizedBy: data.finalized_by as EventMemoryRecord["finalizedBy"],
    version: data.version as number,
  };
}

export async function listEventMemoryRecords(
  options: { limit?: number; venue?: string | null },
  db: SupabaseClient | null = supabaseAdmin
): Promise<EventMemoryRecord[]> {
  const limit = options.limit ?? 50;

  if (USE_LOCAL_EVENTS) {
    const { localListMemoryRecords } = await import("@/lib/local-memory-store");
    let records = await localListMemoryRecords(limit);
    if (options.venue?.trim()) {
      const v = options.venue.trim().toLowerCase();
      records = records.filter((r) => r.eventMeta.venue.toLowerCase().includes(v));
    }
    return records;
  }

  if (!db) return [];

  const { data, error } = await db
    .from("event_memory_records")
    .select("id, payload, finalized_at, finalized_by, version")
    .order("finalized_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  let records = (data ?? []).map((row) => ({
    ...(row.payload as EventMemoryRecord),
    id: row.id as string,
    finalizedAt: row.finalized_at as string,
    finalizedBy: row.finalized_by as EventMemoryRecord["finalizedBy"],
    version: row.version as number,
  }));

  if (options.venue?.trim()) {
    const v = options.venue.trim().toLowerCase();
    records = records.filter((r) => r.eventMeta.venue.toLowerCase().includes(v));
  }

  return records;
}
