import { supabaseAdmin } from "@/lib/supabase-server";
import { wipeEventSubmissions } from "@/lib/event-submissions-wipe";
import { localEventsDelete, localEventsGetById } from "@/lib/local-events-store";
import { unlinkChaptersForEvent } from "@/lib/song-garden-v2/garden/store";

const USE_LOCAL_EVENTS = () => process.env.USE_LOCAL_EVENTS === "true";

export type DeletedEvent = {
  id: string;
  title: string;
};

export async function deleteEventById(eventId: string): Promise<DeletedEvent | null> {
  if (!eventId.trim()) return null;

  if (USE_LOCAL_EVENTS()) {
    const existing = localEventsGetById(eventId);
    if (!existing) return null;
    await unlinkChaptersForEvent(eventId);
    await wipeEventSubmissions(eventId);
    const removed = localEventsDelete(eventId);
    if (!removed) return null;
    return { id: removed.id, title: removed.title };
  }

  if (!supabaseAdmin) {
    throw new Error("Database not configured.");
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  await unlinkChaptersForEvent(eventId);
  await wipeEventSubmissions(eventId);

  const { error: deleteError } = await supabaseAdmin.from("events").delete().eq("id", eventId);
  if (deleteError) throw new Error(deleteError.message);

  return { id: String(data.id), title: String(data.title ?? "") };
}
