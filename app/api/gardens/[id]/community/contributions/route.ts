import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import {
  assertCanParticipate,
  listDiscoverableContributions,
  listInGardenCredits,
  markContributionPerformed,
  markContributionSelected,
  upsertContributionNode,
} from "@/lib/platform-v2/store";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

/** GET discoverable contributions (+ in-Garden credit list). */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  const selectedOnly = new URL(request.url).searchParams.get("selected") === "1";
  const contributions = await listDiscoverableContributions(garden.id, { selectedOnly });
  const credits = await listInGardenCredits(garden.id);

  return NextResponse.json({ contributions, credits }, NO_STORE);
}

/**
 * POST — register / update a contribution node, or Composer/Live seams:
 * { action: "select" | "perform" | "upsert", sourceType, sourceId, ... }
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Garden not found" }, { status: 404, ...NO_STORE });

  try {
    const body = (await request.json()) as {
      action?: "select" | "perform" | "upsert";
      sourceType?: "clip" | "turn" | "pulse";
      sourceId?: string;
      deviceId?: string;
      kind?: string;
      creditName?: string;
      excerpt?: string;
      selected?: boolean;
      rights?: Record<string, boolean>;
    };
    const sourceType = body.sourceType;
    const sourceId = body.sourceId?.trim();
    if (!sourceType || !sourceId) {
      return NextResponse.json({ error: "sourceType and sourceId required" }, { status: 400, ...NO_STORE });
    }

    const action = body.action || "upsert";
    if (action === "select") {
      const node = await markContributionSelected({
        gardenId: garden.id,
        sourceType,
        sourceId,
        actorDeviceId: body.deviceId,
        selected: body.selected !== false,
      });
      return NextResponse.json({ node, recognition: "selected" }, NO_STORE);
    }
    if (action === "perform") {
      const node = await markContributionPerformed({
        gardenId: garden.id,
        sourceType,
        sourceId,
        actorDeviceId: body.deviceId,
      });
      return NextResponse.json({ node, recognition: "performed" }, NO_STORE);
    }

    // Participant upserts (deviceId present) respect identity mode; Composer/admin may omit deviceId.
    if (body.deviceId?.trim()) {
      const gate = await assertCanParticipate(garden.id, body.deviceId);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.reason }, { status: 403, ...NO_STORE });
      }
    }

    const node = await upsertContributionNode({
      gardenId: garden.id,
      sourceType,
      sourceId,
      kind: body.kind || "other",
      creditName: body.creditName ?? null,
      excerpt: body.excerpt ?? null,
      deviceId: body.deviceId ?? null,
      rights: body.rights,
    });
    return NextResponse.json({ node }, NO_STORE);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 400, ...NO_STORE }
    );
  }
}
