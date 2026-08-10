import { NextResponse } from "next/server";
import {
  BALLARD_FC_GARDEN_SLUG,
  ballardFcBrandKit,
} from "@/lib/song-garden-v2/garden/demos/ballard-fc";
import {
  createGarden,
  getGardenByIdOrSlug,
  updateGarden,
} from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * Upsert the Ballard FC Interbay Song Garden demo (map + sponsored zones).
 * Safe to call repeatedly — updates brand kit on an existing slug.
 */
export async function POST() {
  try {
    const brandKit = ballardFcBrandKit();
    const existing = await getGardenByIdOrSlug(BALLARD_FC_GARDEN_SLUG);
    if (existing) {
      const garden = await updateGarden(existing.id, {
        title: "Ballard FC Song Garden",
        kind: "season",
        status: "live",
        brandKit,
      });
      return NextResponse.json(
        { garden, created: false, publicPath: `/g/${BALLARD_FC_GARDEN_SLUG}` },
        NO_STORE
      );
    }
    const garden = await createGarden({
      slug: BALLARD_FC_GARDEN_SLUG,
      title: "Ballard FC Song Garden",
      kind: "season",
      status: "live",
      brandKit,
    });
    return NextResponse.json(
      { garden, created: true, publicPath: `/g/${BALLARD_FC_GARDEN_SLUG}` },
      { status: 201, ...NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
