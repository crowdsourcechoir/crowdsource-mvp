import { NextResponse } from "next/server";
import { getReadyItem, updateReadyShelfItem } from "@/lib/song-garden-v2/garden/store";
import type { GamedayMomentType, GamedayReadyItem } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; itemId: string } };

export async function GET(_request: Request, context: Ctx) {
  const item = await getReadyItem(context.params.itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const body = (await request.json()) as Partial<{
      title: string;
      momentType: GamedayMomentType;
      zoneKey: string | null;
      sponsorKey: string | null;
      note: string | null;
      status: GamedayReadyItem["status"];
      sortIndex: number;
    }>;
    const item = await updateReadyShelfItem(context.params.itemId, body);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
