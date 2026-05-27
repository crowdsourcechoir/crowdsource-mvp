import { supabaseAdmin } from "@/lib/supabase-server";
import { localWipeEventAgentData } from "@/lib/local-agent-interview-store";
import { localSonggardenWipeEvent } from "@/lib/local-songgarden-store";

export type EventWipeCounts = {
  agentInterviews: number;
  songgardenClips: number;
  songSeeds: number;
  memoryRecords: number;
  liveSessions: number;
};

async function countRows(
  table: string,
  column: string,
  value: string
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

function isMissingTableError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

/** Delete rows from a table; skip quietly if the table was never migrated in prod. */
async function deleteRowsIfTableExists(
  table: string,
  column: string,
  value: string
): Promise<number> {
  if (!supabaseAdmin) return 0;
  const count = await countRows(table, column, value);
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
  if (error) {
    if (isMissingTableError(error)) return 0;
    throw new Error(error.message);
  }
  return count;
}

async function deleteRowsRequired(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const count = await countRows(table, column, value);
  if (!supabaseAdmin) return 0;
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
  if (error) throw new Error(error.message);
  return count;
}

export async function wipeEventSubmissions(eventId: string): Promise<EventWipeCounts> {
  const deleted: EventWipeCounts = {
    agentInterviews: 0,
    songgardenClips: 0,
    songSeeds: 0,
    memoryRecords: 0,
    liveSessions: 0,
  };

  if (process.env.USE_LOCAL_EVENTS === "true") {
    deleted.agentInterviews = await localWipeEventAgentData(eventId);
    deleted.songgardenClips = await localSonggardenWipeEvent(eventId);
    return deleted;
  }

  if (!supabaseAdmin) {
    throw new Error("Database not configured.");
  }

  deleted.agentInterviews = await deleteRowsRequired("agent_participants", "event_id", eventId);
  deleted.songgardenClips = await deleteRowsRequired("songgarden_clips", "event_id", eventId);
  deleted.songSeeds = await deleteRowsIfTableExists("song_seeds", "event_id", eventId);
  deleted.memoryRecords = await deleteRowsIfTableExists("event_memory_records", "event_id", eventId);
  deleted.liveSessions = await deleteRowsIfTableExists("prompt_game_sessions", "linked_event_id", eventId);

  return deleted;
}
