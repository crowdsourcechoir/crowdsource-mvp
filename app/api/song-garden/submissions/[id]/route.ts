import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localSongGardenUpdateSubmissionStatus } from "@/lib/local-song-garden-store";
import type { SongGardenSubmissionStatus } from "@/data/songGarden";

function isStatus(input: unknown): input is SongGardenSubmissionStatus {
  return input === "needs_review" || input === "approved" || input === "rejected";
}

function rowToSubmission(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventSlug: String(row.event_slug ?? ""),
    participantName: row.participant_name ? String(row.participant_name) : null,
    promptId: String(row.prompt_id),
    promptTitle: String(row.prompt_title),
    soundType: String(row.sound_type),
    assetCategory: String(row.asset_category),
    pitch: row.pitch ? String(row.pitch) : null,
    midiNote: typeof row.midi_note === "number" ? row.midi_note : null,
    consentStatus: Boolean(row.consent_status),
    textResponse: row.text_response ? String(row.text_response) : null,
    rawAudioUrl: row.raw_audio_url ? String(row.raw_audio_url) : null,
    processedAudioUrl: row.processed_audio_url ? String(row.processed_audio_url) : null,
    status: row.status === "approved" || row.status === "rejected" ? row.status : "needs_review",
    createdAt: String(row.created_at),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!isStatus((body as { status?: unknown }).status)) {
    return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
  }
  const status = (body as { status: SongGardenSubmissionStatus }).status;

  if (!supabaseAdmin) {
    const submission = await localSongGardenUpdateSubmissionStatus(id, status);
    if (!submission) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ submission });
  }

  const { data, error } = await supabaseAdmin
    .from("song_garden_submissions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ submission: rowToSubmission(data) });
}
