import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, updateGarden } from "@/lib/song-garden-v2/garden/store";
import {
  ATMOSPHERE_MODE_LABELS,
  defaultAtmosphere,
  resolveAtmosphere,
  type AtmosphereMode,
  type GardenAtmosphere,
} from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

/** GET current atmosphere (resolved for legacy gardens). */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });
  const atmosphere = resolveAtmosphere(garden.brandKit);
  return NextResponse.json(
    { atmosphere, modes: ATMOSPHERE_MODE_LABELS, gardenId: garden.id },
    NO_STORE
  );
}

/** PATCH atmosphere chooser — vibe video, static photo, map plate, gaussian, brand wash. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  try {
    const body = (await request.json()) as Partial<GardenAtmosphere> & { mode?: string };
    const mode = body.mode as AtmosphereMode | undefined;
    const current = resolveAtmosphere(garden.brandKit);
    const next = defaultAtmosphere({
      ...current,
      ...body,
      mode: mode ?? current.mode,
    });

    // When switching to map_plate, pull live map assets if URLs not provided.
    if (next.mode === "map_plate") {
      next.stillUrl =
        next.stillUrl || garden.brandKit.heroArtworkUrl || garden.brandKit.mapPlate.draftUrl;
      next.videoUrl = next.videoUrl || garden.brandKit.mapPlate.ambientVideoUrl;
      next.posterUrl = next.posterUrl || next.stillUrl;
      next.vibePrompt = next.vibePrompt || garden.brandKit.mapPlate.vibePrompt;
    }

    if (next.mode === "gaussian") {
      // Assets not shipped yet — keep mode so UI can show coming-soon state.
      next.videoUrl = null;
    }

    const updated = await updateGarden(garden.id, {
      brandKit: { atmosphere: next },
    });
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 400, ...NO_STORE });
    }
    return NextResponse.json(
      { atmosphere: resolveAtmosphere(updated.brandKit), garden: updated },
      NO_STORE
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400, ...NO_STORE }
    );
  }
}
