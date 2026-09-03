import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import {
  checkSonggardenRateLimit,
  getRequestClientIp,
  hashClientIp,
} from "@/lib/songgarden/rate-limit";
import { parseDeviceId, parseSessionToken } from "@/lib/songgarden/upload-auth";
import { verifyClipObject } from "@/lib/songgarden/storage-upload";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";
import {
  kindFromSonggardenCategory,
  recordGardenContribution,
} from "@/lib/song-garden-v2/garden/store";
import { effectCelebrationLine } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const MAX_BYTES = 12 * 1024 * 1024;
const VALID_CATEGORIES = new Set(SONGGARDEN_CATEGORIES.map((c) => c.id));

const CLIP_SELECT =
  "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at, trim_lead_ms, trim_trail_ms, trim_status, has_original, audio_storage_path, audio_original_storage_path";
const CLIP_SELECT_NO_TRIM =
  "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at, audio_storage_path, audio_original_storage_path";

function isTrimSchemaMissing(message: string): boolean {
  return /audio_data_original|trim_lead_ms|trim_trail_ms|trim_status|has_original/i.test(message);
}

function rowToClip(row: Record<string, unknown>): SonggardenClip {
  const trimStatus =
    row.trim_status === "trimmed" || row.trim_status === "skipped" || row.trim_status === "none"
      ? row.trim_status
      : "none";
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
    trimLeadMs: row.trim_lead_ms != null ? Number(row.trim_lead_ms) : null,
    trimTrailMs: row.trim_trail_ms != null ? Number(row.trim_trail_ms) : null,
    trimStatus,
    hasOriginal: Boolean(row.has_original),
  };
}

function isStorageSchemaMissing(message: string): boolean {
  return /audio_storage_path|audio_original_storage_path|audio_data.*not null/i.test(message);
}

async function checkRateLimitForEvent(
  request: Request,
  eventId: string,
  deviceId: string,
  sessionToken: string | null
): Promise<{ ok: true } | { ok: false; error: string; retryAfterMs?: number }> {
  if (!supabaseAdmin) return { ok: true };
  const ipHash = hashClientIp(getRequestClientIp(request));
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: deviceRows, error: deviceErr } = await supabaseAdmin
    .from("songgarden_clips")
    .select("submitted_at, device_id, session_token, ip_hash")
    .eq("event_id", eventId)
    .eq("device_id", deviceId)
    .gte("submitted_at", dayAgo)
    .order("submitted_at", { ascending: false });

  if (deviceErr) {
    return { ok: false, error: deviceErr.message };
  }

  let ipRows: typeof deviceRows = [];
  if (ipHash) {
    const { data, error: ipErr } = await supabaseAdmin
      .from("songgarden_clips")
      .select("submitted_at, device_id, session_token, ip_hash")
      .eq("event_id", eventId)
      .eq("ip_hash", ipHash)
      .gte("submitted_at", hourAgo);
    if (ipErr) return { ok: false, error: ipErr.message };
    ipRows = data ?? [];
  }

  const recent = [...(deviceRows ?? []), ...ipRows].map((r) => ({
    submittedAt: String(r.submitted_at),
    deviceId: r.device_id != null ? String(r.device_id) : null,
    sessionToken: r.session_token != null ? String(r.session_token) : null,
    ipHash: r.ip_hash != null ? String(r.ip_hash) : null,
  }));

  const limit = checkSonggardenRateLimit({
    eventId,
    deviceId,
    sessionToken,
    ipHash,
    recent,
  });
  if (!limit.ok) {
    return { ok: false, error: limit.error, retryAfterMs: limit.retryAfterMs };
  }
  return { ok: true };
}

function parseTrimStatus(value: unknown): SonggardenClip["trimStatus"] {
  if (value === "trimmed" || value === "skipped" || value === "none") return value;
  return "none";
}

/**
 * After client PUTs to signed URL(s), persist clip metadata (no bytes through Vercel).
 */
export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503, ...NO_STORE });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventId?: string;
      category?: string;
      deviceId?: string;
      sessionToken?: string;
      contributorName?: string | null;
      label?: string | null;
      filename?: string;
      mimeType?: string;
      durationMs?: number | null;
      trimLeadMs?: number | null;
      trimTrailMs?: number | null;
      trimStatus?: string;
      playablePath?: string;
      originalPath?: string | null;
    };

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400, ...NO_STORE });
    }

    const deviceId = parseDeviceId(body.deviceId ?? null);
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required." }, { status: 400, ...NO_STORE });
    }
    const sessionToken = parseSessionToken(body.sessionToken ?? null);

    const category = body.category;
    if (typeof category !== "string" || !VALID_CATEGORIES.has(category as SonggardenCategoryId)) {
      return NextResponse.json({ error: "Valid category is required." }, { status: 400, ...NO_STORE });
    }

    const playablePath = typeof body.playablePath === "string" ? body.playablePath.trim() : "";
    if (!playablePath.startsWith("clips/")) {
      return NextResponse.json({ error: "Invalid playablePath." }, { status: 400, ...NO_STORE });
    }

    const originalPath =
      typeof body.originalPath === "string" && body.originalPath.trim()
        ? body.originalPath.trim()
        : null;
    if (originalPath && !originalPath.startsWith("clips/")) {
      return NextResponse.json({ error: "Invalid originalPath." }, { status: 400, ...NO_STORE });
    }

    const rate = await checkRateLimitForEvent(request, eventId, deviceId, sessionToken);
    if (!rate.ok) {
      return NextResponse.json(
        { error: rate.error, retryAfterMs: rate.retryAfterMs ?? null },
        { status: 429, ...NO_STORE }
      );
    }

    const playableOk = await verifyClipObject(playablePath, MAX_BYTES);
    if (!playableOk) {
      return NextResponse.json(
        { error: "Playable upload not found. Complete the Storage PUT before confirm." },
        { status: 400, ...NO_STORE }
      );
    }

    if (originalPath) {
      const originalOk = await verifyClipObject(originalPath, MAX_BYTES);
      if (!originalOk) {
        return NextResponse.json(
          { error: "Original upload not found." },
          { status: 400, ...NO_STORE }
        );
      }
    }

    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.startsWith("audio/")
        ? body.mimeType
        : "audio/wav";
    const ext = (body.filename?.split(".").pop() || "wav").toLowerCase();
    const safeFilename =
      typeof body.label === "string" && body.label.trim()
        ? `${body.label.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48)}.${ext}`
        : (body.filename ?? "sound.wav").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64) || `sound.${ext}`;

    const trimStatus = parseTrimStatus(body.trimStatus);
    const hasOriginal = Boolean(originalPath);
    const durationMs = Number(body.durationMs);
    const trimLeadMs = Number(body.trimLeadMs);
    const trimTrailMs = Number(body.trimTrailMs);
    const ipHash = hashClientIp(getRequestClientIp(request));

    // Originals live in Storage (audio_original_storage_path); never write audio_data_original bytea.
    const insertRow = {
      event_id: eventId,
      contributor_name:
        typeof body.contributorName === "string" ? body.contributorName.trim() || null : null,
      label: typeof body.label === "string" ? body.label.trim() || null : null,
      category,
      filename: safeFilename,
      mime_type: mimeType,
      duration_ms: Number.isFinite(durationMs) ? durationMs : null,
      device_id: deviceId,
      session_token: sessionToken,
      ip_hash: ipHash,
      audio_data: null,
      audio_storage_path: playablePath,
      audio_original_storage_path: originalPath,
      trim_lead_ms: Number.isFinite(trimLeadMs) ? trimLeadMs : null,
      trim_trail_ms: Number.isFinite(trimTrailMs) ? trimTrailMs : null,
      trim_status: trimStatus,
      has_original: hasOriginal,
    };

    let { data, error } = await supabaseAdmin
      .from("songgarden_clips")
      .insert(insertRow)
      .select(CLIP_SELECT)
      .single();

    // Prod may not have run supabase/songgarden-trim-originals.sql — keep storage paths, drop trim cols.
    if (error && isTrimSchemaMissing(error.message)) {
      const {
        trim_lead_ms: _l,
        trim_trail_ms: _t,
        trim_status: _s,
        has_original: _h,
        ...noTrimRow
      } = insertRow;
      const fallback = await supabaseAdmin
        .from("songgarden_clips")
        .insert(noTrimRow)
        .select(CLIP_SELECT_NO_TRIM)
        .single();
      data = fallback.data
        ? {
            ...fallback.data,
            trim_lead_ms: null,
            trim_trail_ms: null,
            trim_status: "none",
            has_original: hasOriginal,
          }
        : null;
      error = fallback.error;
    }

    if (error && isStorageSchemaMissing(error.message)) {
      return NextResponse.json(
        {
          error:
            "Storage columns not available. Run supabase/songgarden-storage-paths.sql in Supabase SQL Editor.",
          code: "schema_missing",
        },
        { status: 503, ...NO_STORE }
      );
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400, ...NO_STORE });
    if (!data) return NextResponse.json({ error: "Insert failed." }, { status: 500, ...NO_STORE });

    const clip = rowToClip(data as Record<string, unknown>);
    const garden = await recordGardenContribution({
      eventId,
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
  } catch (err) {
    console.error("Songgarden upload confirm error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500, ...NO_STORE }
    );
  }
}
