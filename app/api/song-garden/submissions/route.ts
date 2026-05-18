import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localSongGardenCreateSubmission,
  localSongGardenListSubmissions,
} from "@/lib/local-song-garden-store";
import type { SongGardenAssetCategory, SongGardenSoundType } from "@/data/songGarden";

const MEDIA_BUCKET = process.env.SUPABASE_SONG_GARDEN_BUCKET || "song-garden-media";
let mediaBucketChecked = false;

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "bin";
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; extension: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid media format.");
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  return { bytes, contentType, extension: extFromMime(contentType) };
}

async function ensureMediaBucket() {
  if (!supabaseAdmin || mediaBucketChecked) return;
  mediaBucketChecked = true;
  const { data: existing, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) return;
  if (!existing?.some((bucket) => bucket.name === MEDIA_BUCKET)) {
    await supabaseAdmin.storage.createBucket(MEDIA_BUCKET, { public: true });
  }
}

async function persistAudio(eventId: string, promptId: string, dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  if (!supabaseAdmin) return dataUrl;

  await ensureMediaBucket();
  const parsed = decodeDataUrl(dataUrl);
  const filePath = `events/${eventId}/${promptId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.extension}`;
  const { error: uploadErr } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(filePath, parsed.bytes, {
    contentType: parsed.contentType,
    upsert: false,
  });
  if (uploadErr) throw new Error("Failed to upload Song Garden audio.");
  const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function rowToSubmission(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventSlug: String(row.event_slug ?? ""),
    participantName: row.participant_name ? String(row.participant_name) : null,
    promptId: String(row.prompt_id),
    promptTitle: String(row.prompt_title),
    soundType: String(row.sound_type) as SongGardenSoundType,
    assetCategory: String(row.asset_category) as SongGardenAssetCategory,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  if (!supabaseAdmin) {
    const submissions = await localSongGardenListSubmissions(eventId);
    return NextResponse.json({ submissions });
  }

  const { data, error } = await supabaseAdmin
    .from("song_garden_submissions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: (data ?? []).map(rowToSubmission) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventId = String(body.eventId ?? "").trim();
    const eventSlug = String(body.eventSlug ?? "").trim();
    const promptId = String(body.promptId ?? "").trim();
    const promptTitle = String(body.promptTitle ?? "").trim();
    const soundType = String(body.soundType ?? "") as SongGardenSoundType;
    const assetCategory = String(body.assetCategory ?? "") as SongGardenAssetCategory;
    const consentStatus = Boolean(body.consentStatus);
    const rawAudioDataUrl = typeof body.audioDataUrl === "string" ? body.audioDataUrl : null;
    const textResponse = typeof body.textResponse === "string" && body.textResponse.trim()
      ? body.textResponse.trim()
      : null;

    if (!eventId || !eventSlug || !promptId || !promptTitle || !soundType || !assetCategory) {
      return NextResponse.json({ error: "Missing Song Garden submission metadata." }, { status: 400 });
    }
    if (!consentStatus) {
      return NextResponse.json({ error: "Consent is required before submitting." }, { status: 400 });
    }
    if (!rawAudioDataUrl && !textResponse) {
      return NextResponse.json({ error: "Record audio or add text before submitting." }, { status: 400 });
    }

    const rawAudioUrl = await persistAudio(eventId, promptId, rawAudioDataUrl);
    const submissionInput = {
      eventId,
      eventSlug,
      participantName: typeof body.participantName === "string" && body.participantName.trim()
        ? body.participantName.trim()
        : null,
      promptId,
      promptTitle,
      soundType,
      assetCategory,
      pitch: typeof body.pitch === "string" && body.pitch.trim() ? body.pitch.trim() : null,
      midiNote: typeof body.midiNote === "number" ? body.midiNote : null,
      consentStatus,
      textResponse,
      rawAudioUrl,
    };

    if (!supabaseAdmin) {
      const submission = await localSongGardenCreateSubmission(submissionInput);
      return NextResponse.json({ submission });
    }

    const { data, error } = await supabaseAdmin
      .from("song_garden_submissions")
      .insert({
        event_id: submissionInput.eventId,
        event_slug: submissionInput.eventSlug,
        participant_name: submissionInput.participantName,
        prompt_id: submissionInput.promptId,
        prompt_title: submissionInput.promptTitle,
        sound_type: submissionInput.soundType,
        asset_category: submissionInput.assetCategory,
        pitch: submissionInput.pitch,
        midi_note: submissionInput.midiNote,
        consent_status: submissionInput.consentStatus,
        text_response: submissionInput.textResponse,
        raw_audio_url: submissionInput.rawAudioUrl,
        processed_audio_url: null,
        status: "needs_review",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ submission: rowToSubmission(data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
