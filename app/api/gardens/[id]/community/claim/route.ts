import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { claimIdentity, getCommunitySettings } from "@/lib/platform-v2/store";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

/** POST — claim identity (display name + email) for this device on the Garden. */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  try {
    const body = (await request.json()) as {
      deviceId?: string;
      displayName?: string;
      email?: string;
    };
    const identity = await claimIdentity({
      gardenId: garden.id,
      deviceId: body.deviceId || "",
      displayName: body.displayName || "",
      email: body.email || "",
    });
    const settings = await getCommunitySettings(garden.id);
    return NextResponse.json({ identity, settings }, NO_STORE);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claim failed" },
      { status: 400, ...NO_STORE }
    );
  }
}
