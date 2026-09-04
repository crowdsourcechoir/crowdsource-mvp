import { NextResponse } from "next/server";
import {
  deleteGarden,
  getGardenByIdOrSlug,
  listChapters,
  updateGarden,
} from "@/lib/song-garden-v2/garden/store";
import type { BrandKit, GardenKind, GardenStatus, MutationPolicy } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const chapters = await listChapters(garden.id);
    return NextResponse.json({ garden, chapters }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const body = (await request.json()) as {
      title?: string;
      kind?: GardenKind;
      status?: GardenStatus;
      brandKit?: Partial<BrandKit>;
      mutationPolicy?: Partial<MutationPolicy>;
      commerce?: unknown | null;
    };
    const garden = await updateGarden(context.params.id, body);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ garden }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const garden = await deleteGarden(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: { id: garden.id, title: garden.title } }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
