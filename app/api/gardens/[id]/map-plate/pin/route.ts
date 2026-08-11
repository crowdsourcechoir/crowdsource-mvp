import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { pinMapPlate } from "@/lib/song-garden-v2/garden/map-plate";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

/**
 * Pin a map plate draft (or explicit URL) as the live season map.
 * Sets `brandKit.heroArtworkUrl`; does not touch zones or hit regions.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    let body: {
      url?: string;
      seasonLabel?: string;
      confirmReplace?: boolean;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const result = await pinMapPlate(garden, {
      url: body.url,
      seasonLabel: body.seasonLabel,
      confirmReplace: body.confirmReplace === true,
    });

    return NextResponse.json(
      { garden: result.garden, plateUrl: result.plateUrl },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("confirmReplace") ? 409 : 400;
    return NextResponse.json({ error: message }, { status, ...NO_STORE });
  }
}
