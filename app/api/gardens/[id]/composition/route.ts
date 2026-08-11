import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  getGardenByIdOrSlug,
  listChapters,
  listMutationsThrough,
} from "@/lib/song-garden-v2/garden/store";
import { localSonggardenList } from "@/lib/local-songgarden-store";
import type { SonggardenCategoryId, SonggardenClip } from "@/lib/songgarden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const USE_LOCAL_EVENTS = process.env.USE_LOCAL_EVENTS === "true";

type Ctx = { params: { id: string } };

export type GardenCompositionClip = SonggardenClip & {
  zoneKey: string | null;
  chapterLabel: string | null;
};

export type GardenCompositionMark = {
  id: string;
  zoneKey: string | null;
  note: string;
  createdAt: string;
  kind: string;
};

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

async function listClipsForEvent(eventId: string): Promise<SonggardenClip[]> {
  if (USE_LOCAL_EVENTS) return localSonggardenList(eventId);
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("songgarden_clips")
    .select(
      "id, event_id, contributor_name, label, category, filename, mime_type, duration_ms, device_id, session_token, submitted_at"
    )
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (error || !data) {
    console.warn("[gardens/composition] list clips failed:", error?.message);
    return [];
  }
  return data.map((r) => rowToClip(r as Record<string, unknown>));
}

/**
 * Composition canvas feed for a Fans garden: audio clips from attached chapter
 * events, joined with zone keys from garden mutations when present, plus text
 * zone marks (pulses) for matchday listening / copy.
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    const chapters = await listChapters(garden.id);
    const mutations = await listMutationsThrough(garden.id, new Date().toISOString());

    const clipZone = new Map<string, string>();
    const marks: GardenCompositionMark[] = [];
    for (const mut of mutations) {
      const zoneFromDelta =
        typeof mut.delta.zoneKey === "string" ? mut.delta.zoneKey.trim() : "";
      if (mut.sourceType === "clip" && mut.sourceId && zoneFromDelta) {
        clipZone.set(mut.sourceId, zoneFromDelta);
      }
      if (mut.sourceType === "pulse") {
        const note =
          typeof mut.delta.note === "string"
            ? mut.delta.note.trim()
            : typeof mut.delta.response === "string"
              ? mut.delta.response.trim()
              : "";
        if (note) {
          marks.push({
            id: mut.id,
            zoneKey: zoneFromDelta || null,
            note,
            createdAt: mut.createdAt,
            kind: mut.kind,
          });
        }
      }
    }

    // Newest pulse notes first
    marks.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const clips: GardenCompositionClip[] = [];
    for (const chapter of chapters) {
      const eventClips = await listClipsForEvent(chapter.eventId);
      for (const clip of eventClips) {
        clips.push({
          ...clip,
          zoneKey: clipZone.get(clip.id) ?? null,
          chapterLabel: chapter.label || `Show ${chapter.index}`,
        });
      }
    }

    clips.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

    return NextResponse.json(
      {
        garden: {
          id: garden.id,
          slug: garden.slug,
          title: garden.title,
        },
        zones: garden.brandKit.zones.map((z) => ({
          key: z.key,
          label: z.label,
        })),
        chapters: chapters.map((c) => ({
          id: c.id,
          eventId: c.eventId,
          label: c.label,
          index: c.index,
        })),
        clips,
        marks: marks.slice(0, 200),
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
