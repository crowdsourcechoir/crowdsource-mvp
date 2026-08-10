import { NextResponse } from "next/server";
import { getEdition, getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; editionSlug: string } };

export async function GET(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const edition = await getEdition(garden.id, context.params.editionSlug);
    if (!edition) return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    return NextResponse.json({ edition }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
