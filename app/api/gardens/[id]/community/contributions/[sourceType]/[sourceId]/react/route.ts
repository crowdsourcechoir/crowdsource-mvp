import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { addReact } from "@/lib/platform-v2/store";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = {
  params: Promise<{ id: string; sourceType: string; sourceId: string }>;
};

/** POST heart react on a contribution (emits amplify recognition). */
export async function POST(request: Request, ctx: Ctx) {
  const { id, sourceType: rawType, sourceId: rawId } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  const sourceType =
    rawType === "clip" || rawType === "turn" || rawType === "pulse" ? rawType : null;
  const sourceId = decodeURIComponent(rawId || "").trim();
  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "Invalid contribution ref" }, { status: 400, ...NO_STORE });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { deviceId?: string };
    const deviceId = body.deviceId?.trim();
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400, ...NO_STORE });
    }
    const result = await addReact({
      gardenId: garden.id,
      sourceType,
      sourceId,
      deviceId,
    });
    return NextResponse.json(
      {
        react: result.react,
        created: result.created,
        node: result.node,
        recognition: result.created ? "amplified" : null,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "React failed";
    const status = message.includes("claimed identity") ? 403 : 400;
    return NextResponse.json({ error: message }, { status, ...NO_STORE });
  }
}
