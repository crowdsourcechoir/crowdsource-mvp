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
  if (error) return 0;
  return count ?? 0;
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

  deleted.agentInterviews = await countRows("agent_participants", "event_id", eventId);
  const { error: agentErr } = await supabaseAdmin
    .from("agent_participants")
    .delete()
    .eq("event_id", eventId);
  if (agentErr) throw new Error(agentErr.message);

  deleted.songgardenClips = await countRows("songgarden_clips", "event_id", eventId);
  const { error: sgErr } = await supabaseAdmin
    .from("songgarden_clips")
    .delete()
    .eq("event_id", eventId);
  if (sgErr) throw new Error(sgErr.message);

  deleted.songSeeds = await countRows("song_seeds", "event_id", eventId);
  const { error: seedErr } = await supabaseAdmin.from("song_seeds").delete().eq("event_id", eventId);
  if (seedErr) throw new Error(seedErr.message);

  deleted.memoryRecords = await countRows("event_memory_records", "event_id", eventId);
  const { error: memErr } = await supabaseAdmin
    .from("event_memory_records")
    .delete()
    .eq("event_id", eventId);
  if (memErr) throw new Error(memErr.message);

  deleted.liveSessions = await countRows("prompt_game_sessions", "linked_event_id", eventId);
  const { error: liveErr } = await supabaseAdmin
    .from("prompt_game_sessions")
    .delete()
    .eq("linked_event_id", eventId);
  if (liveErr) throw new Error(liveErr.message);

  return deleted;
}
