import { NextResponse } from "next/server";
import {
  createClipSignedUpload,
  newClipObjectPath,
  sanitizeClipStorageKey,
} from "@/lib/songgarden/storage-upload";
import { parseDeviceId, parseSessionToken } from "@/lib/songgarden/upload-auth";
import { SONGGARDEN_CATEGORIES } from "@/lib/songgarden/categories";
import type { SonggardenCategoryId } from "@/lib/songgarden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const MAX_BYTES = 12 * 1024 * 1024;
const VALID_CATEGORIES = new Set(SONGGARDEN_CATEGORIES.map((c) => c.id));

/**
 * Mint signed upload URL(s) for participant sound clips.
 * Client PUTs WAV directly to Storage, then POSTs /api/songgarden/upload/confirm.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventId?: string;
      category?: string;
      deviceId?: string;
      sessionToken?: string;
      playableSize?: number;
      originalSize?: number;
      contentType?: string;
      ext?: string;
    };

    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400, ...NO_STORE });
    }

    const deviceId = parseDeviceId(body.deviceId ?? null);
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required." }, { status: 400, ...NO_STORE });
    }
    parseSessionToken(body.sessionToken ?? null);

    const category = body.category;
    if (typeof category !== "string" || !VALID_CATEGORIES.has(category as SonggardenCategoryId)) {
      return NextResponse.json({ error: "Valid category is required." }, { status: 400, ...NO_STORE });
    }

    const playableSize = Number(body.playableSize) || 0;
    if (playableSize <= 0 || playableSize > MAX_BYTES) {
      return NextResponse.json(
        { error: `Playable audio must be 1 byte – ${MAX_BYTES} bytes.` },
        { status: 400, ...NO_STORE }
      );
    }

    const originalSize = Number(body.originalSize) || 0;
    if (originalSize > MAX_BYTES) {
      return NextResponse.json({ error: "Original audio too large (max 12 MB)." }, { status: 400, ...NO_STORE });
    }

    const ext =
      typeof body.ext === "string" && /^[a-z0-9]{1,8}$/i.test(body.ext.trim())
        ? body.ext.trim().toLowerCase()
        : "wav";

    const eventKey = sanitizeClipStorageKey(eventId);
    const playablePath = newClipObjectPath(eventKey, "playable", ext);
    const playable = await createClipSignedUpload(playablePath);

    let original: Awaited<ReturnType<typeof createClipSignedUpload>> | null = null;
    if (originalSize > 0) {
      const originalPath = newClipObjectPath(eventKey, "original", ext);
      original = await createClipSignedUpload(originalPath);
    }

    return NextResponse.json(
      {
        playable,
        original,
        maxBytes: MAX_BYTES,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
