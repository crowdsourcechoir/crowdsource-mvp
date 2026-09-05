import { NextResponse } from "next/server";
import {
  getChapterByEventId,
  getGardenByIdOrSlug,
  listChapters,
} from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

/**
 * Resolve the Song Garden (if any) that contains this bloom/event as a chapter.
 * Used by Composer to offer garden-scoped vs bloom-scoped libraries.
 */
export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const chapter = await getChapterByEventId(eventId);
    if (!chapter) {
      return NextResponse.json({ garden: null, chapters: [], chapter: null });
    }
    const garden = await getGardenByIdOrSlug(chapter.gardenId);
    if (!garden) {
      return NextResponse.json({ garden: null, chapters: [], chapter: null });
    }
    const chapters = await listChapters(garden.id);
    return NextResponse.json({
      garden: {
        id: garden.id,
        slug: garden.slug,
        title: garden.title,
        status: garden.status,
      },
      chapter: {
        id: chapter.id,
        eventId: chapter.eventId,
        label: chapter.label,
        index: chapter.index,
        status: chapter.status,
      },
      chapters: chapters.map((c) => ({
        id: c.id,
        eventId: c.eventId,
        label: c.label,
        index: c.index,
        status: c.status,
      })),
    });
  } catch (err) {
    console.warn("[gardens/by-event]", err);
    return NextResponse.json({ garden: null, chapters: [], chapter: null });
  }
}
