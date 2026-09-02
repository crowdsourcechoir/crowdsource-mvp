import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { computeParticipationIndex } from "@/lib/platform-v2/store";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET Participation Index v0 — packaging-ready for Sales / Learfield.
 * Does not write Sales CRM.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  const index = await computeParticipationIndex(garden);
  return NextResponse.json({ index }, NO_STORE);
}
