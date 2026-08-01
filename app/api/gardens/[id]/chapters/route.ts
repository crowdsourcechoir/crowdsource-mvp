import { NextResponse } from "next/server";
import { addChapter, getGardenByIdOrSlug, listChapters } from "@/lib/song-garden-v2/garden/store";
import type { ChapterStatus } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  const garden = await getGardenByIdOrSlug(context.params.id);
  if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const chapters = await listChapters(garden.id);
  return NextResponse.json({ chapters }, NO_STORE);
}

export async function POST(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json()) as {
      eventId?: string;
      index?: number;
      label?: string;
      chapterWeight?: number;
      status?: ChapterStatus;
      opensAt?: string | null;
      closesAt?: string | null;
    };

    if (!body.eventId?.trim()) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }
    const index = Number(body.index);
    if (!Number.isFinite(index) || index < 1) {
      return NextResponse.json({ error: "index must be a positive number." }, { status: 400 });
    }

    const chapter = await addChapter({
      gardenId: garden.id,
      eventId: body.eventId.trim(),
      index,
      label: body.label,
      chapterWeight: body.chapterWeight,
      status: body.status,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
    });
    return NextResponse.json({ chapter }, { status: 201, ...NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /already/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
