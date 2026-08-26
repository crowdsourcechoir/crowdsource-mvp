import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import {
  getCommunitySettings,
  getIdentity,
  patchCommunitySettings,
} from "@/lib/platform-v2/store";
import { normalizeCommunitySettings } from "@/lib/platform-v2/types";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

/** GET community identity settings (+ optional device identity). */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  const settings = await getCommunitySettings(garden.id);
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  const identity = deviceId ? await getIdentity(garden.id, deviceId) : null;

  return NextResponse.json(
    {
      gardenId: garden.id,
      slug: garden.slug,
      settings,
      identity,
    },
    NO_STORE
  );
}

/** PATCH community settings (admin). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = normalizeCommunitySettings({
      ...(await getCommunitySettings(garden.id)),
      ...(body as object),
    });
    const settings = await patchCommunitySettings(garden.id, patch);
    return NextResponse.json({ settings }, NO_STORE);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400, ...NO_STORE }
    );
  }
}
