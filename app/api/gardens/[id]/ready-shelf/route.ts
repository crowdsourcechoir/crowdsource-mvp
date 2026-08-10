import { NextResponse } from "next/server";
import {
  createReadyShelfItem,
  getGardenByIdOrSlug,
  listReadyShelf,
  promoteToReadyShelf,
} from "@/lib/song-garden-v2/garden/store";
import type { GamedayMomentType } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

const MOMENTS: GamedayMomentType[] = [
  "kickoff",
  "goal",
  "halftime",
  "timeout",
  "walkup",
  "rivalry",
  "general",
];

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const items = await listReadyShelf(garden.id);
    return NextResponse.json(
      {
        items,
        zones: garden.brandKit.zones,
        sponsors: garden.brandKit.sponsors,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const body = (await request.json()) as {
      title?: string;
      momentType?: GamedayMomentType;
      zoneKey?: string | null;
      sponsorKey?: string | null;
      note?: string | null;
      promote?: boolean;
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    const momentType =
      body.momentType && MOMENTS.includes(body.momentType) ? body.momentType : "general";

    const item = body.promote
      ? await promoteToReadyShelf({
          gardenIdOrSlug: context.params.id,
          title: body.title,
          momentType,
          zoneKey: body.zoneKey,
          note: body.note,
        })
      : await createReadyShelfItem({
          gardenIdOrSlug: context.params.id,
          title: body.title,
          momentType,
          zoneKey: body.zoneKey,
          sponsorKey: body.sponsorKey,
          note: body.note,
        });

    return NextResponse.json({ item }, { status: 201, ...NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
