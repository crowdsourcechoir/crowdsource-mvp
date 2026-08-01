import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  localSonggardenAddClip,
  localSonggardenList,
  localSonggardenSubmissionRecords,
} from "@/lib/local-songgarden-store";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import {
  checkSonggardenRateLimit,
  getRequestClientIp,
  hashClientIp,
} from "@/lib/songgarden/rate-limit";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";
import { encodeSupabaseBytea } from "@/lib/supabase-bytea";
import {
  kindFromSonggardenCategory,
  recordGardenContribution,
} from "@/lib/song-garden-v2/garden/store";
import { effectCelebrationLine } from "@/lib/song-garden-v2/garden/types";

const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";
const MAX_BYTES = 12 * 1024 * 1024;
const VALID_CATEGORIES = new Set(SONGGARDEN_CATEGORIES.map((c) => c.id));

function rowToClip(row: Record<string, unknown>): SonggardenClip {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    contributorName: row.contributor_name != null ? String(row.contributor_name) : null,
    label: row.label != null ? String(row.label) : null,
    category: row.category as SonggardenCategoryId,
    filename: String(row.filename),
    mimeType: String(row.mime_type ?? "audio/wav"),
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    deviceId: row.device_id != null ? String(row.device_id) : "",
    sessionToken: row.session_token != null ? String(row.session_token) : null,
    submittedAt: String(row.submitted_at),
  };
}

function parseDeviceId(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^dev_[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}

function parseSessionToken(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^sg_sess_[a-zA-Z0-9_-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const since = searchParams.get("since");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  if (USE_LOCAL_EVENTS) {
    const clips = await localSonggardenList(eventId, since);
    return NextResponse.json({ clips });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    let q = supabaseAdmin
      .from("songgarden_clips")
      .select(
        "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at"
      )
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false });
    if (since) q = q.gt("submitted_at", since);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ clips: (data ?? []).map(rowToClip) });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const eventId = form.get("eventId");
  const category = form.get("category");
  const contributorName = form.get("contributorName");
  const label = form.get("label");
  const durationMsRaw = form.get("durationMs");
  const deviceId = parseDeviceId(form.get("deviceId"));
  const sessionToken = parseSessionToken(form.get("sessionToken"));
  const file = form.get("audio");

  if (typeof eventId !== "string" || !eventId.trim()) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }
  if (typeof category !== "string" || !VALID_CATEGORIES.has(category as SonggardenCategoryId)) {
    return NextResponse.json({ error: "Valid category is required." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "audio file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio file too large (max 12 MB)." }, { status: 400 });
  }

  const mimeType = file.type || "audio/wav";
  if (!mimeType.startsWith("audio/")) {
    return NextResponse.json({ error: "Only audio files are accepted." }, { status: 400 });
  }

  const ipHash = hashClientIp(getRequestClientIp(request));
  const trimmedEventId = eventId.trim();

  if (USE_LOCAL_EVENTS) {
    const recent = await localSonggardenSubmissionRecords(trimmedEventId);
    const limit = checkSonggardenRateLimit({
      eventId: trimmedEventId,
      deviceId,
      sessionToken,
      ipHash,
      recent,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.error, retryAfterMs: limit.retryAfterMs ?? null },
        { status: 429 }
      );
    }
  } else if (supabaseAdmin) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: deviceRows, error: deviceErr } = await supabaseAdmin
      .from("songgarden_clips")
      .select("submitted_at, device_id, session_token, ip_hash")
      .eq("event_id", trimmedEventId)
      .eq("device_id", deviceId)
      .gte("submitted_at", dayAgo)
      .order("submitted_at", { ascending: false });

    if (deviceErr) {
      return NextResponse.json({ error: deviceErr.message }, { status: 500 });
    }

    let ipRows: typeof deviceRows = [];
    if (ipHash) {
      const { data, error: ipErr } = await supabaseAdmin
        .from("songgarden_clips")
        .select("submitted_at, device_id, session_token, ip_hash")
        .eq("event_id", trimmedEventId)
        .eq("ip_hash", ipHash)
        .gte("submitted_at", hourAgo);
      if (ipErr) return NextResponse.json({ error: ipErr.message }, { status: 500 });
      ipRows = data ?? [];
    }

    const recent = [...(deviceRows ?? []), ...ipRows].map((r) => ({
      submittedAt: String(r.submitted_at),
      deviceId: r.device_id != null ? String(r.device_id) : null,
      sessionToken: r.session_token != null ? String(r.session_token) : null,
      ipHash: r.ip_hash != null ? String(r.ip_hash) : null,
    }));

    const limit = checkSonggardenRateLimit({
      eventId: trimmedEventId,
      deviceId,
      sessionToken,
      ipHash,
      recent,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.error, retryAfterMs: limit.retryAfterMs ?? null },
        { status: 429 }
      );
    }
  }

  const ext = (file.name.split(".").pop() || "wav").toLowerCase();
  const safeFilename =
    typeof label === "string" && label.trim()
      ? `${label.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48)}.${ext}`
      : file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64) || `sound.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const durationMs =
    typeof durationMsRaw === "string" && durationMsRaw.trim()
      ? Number(durationMsRaw)
      : null;

  if (USE_LOCAL_EVENTS) {
    const clip = await localSonggardenAddClip({
      eventId: trimmedEventId,
      contributorName: typeof contributorName === "string" ? contributorName.trim() || null : null,
      label: typeof label === "string" ? label.trim() || null : null,
      category: category as SonggardenCategoryId,
      filename: safeFilename,
      mimeType,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
      deviceId,
      sessionToken,
      audioBuffer: buffer,
      ext,
    });
    const garden = await recordGardenContribution({
      eventId: trimmedEventId,
      kind: kindFromSonggardenCategory(String(category)),
      sourceType: "clip",
      sourceId: clip.id,
      deviceId,
    });
    return NextResponse.json({
      clip,
      gardenEffects: garden?.effects ?? null,
      gardenCelebrationLine: garden ? effectCelebrationLine(garden.effects) : null,
      gardenWorldVersion: garden?.worldVersion ?? null,
    });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("songgarden_clips")
      .insert({
        event_id: trimmedEventId,
        contributor_name:
          typeof contributorName === "string" ? contributorName.trim() || null : null,
        label: typeof label === "string" ? label.trim() || null : null,
        category,
        filename: safeFilename,
        mime_type: mimeType,
        duration_ms: Number.isFinite(durationMs) ? durationMs : null,
        device_id: deviceId,
        session_token: sessionToken,
        ip_hash: ipHash,
        audio_data: encodeSupabaseBytea(buffer),
      })
      .select(
        "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at"
      )
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const clip = rowToClip(data);
    const garden = await recordGardenContribution({
      eventId: trimmedEventId,
      kind: kindFromSonggardenCategory(String(category)),
      sourceType: "clip",
      sourceId: clip.id,
      deviceId,
    });
    return NextResponse.json({
      clip,
      gardenEffects: garden?.effects ?? null,
      gardenCelebrationLine: garden ? effectCelebrationLine(garden.effects) : null,
      gardenWorldVersion: garden?.worldVersion ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
