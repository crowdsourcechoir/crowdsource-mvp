import { NextResponse } from "next/server";
import { finalizeChapter, getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { effectCelebrationLine } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; chapterId: string } };

/** Seal a chapter: close it, apply finale weight, unlock chapter landmark. */
export async function POST(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sealed = await finalizeChapter({
      gardenIdOrSlug: garden.id,
      chapterId: context.params.chapterId,
    });
    if (!sealed) {
      return NextResponse.json(
        { error: "Chapter could not be finalized (missing or already closed)." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      chapter: sealed.chapter,
      worldVersion: sealed.result.worldVersion,
      gardenEffects: sealed.result.effects,
      gardenCelebrationLine: effectCelebrationLine(sealed.result.effects),
      state: sealed.result.garden.worldState,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
