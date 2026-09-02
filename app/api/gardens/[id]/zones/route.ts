import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, updateGarden } from "@/lib/song-garden-v2/garden/store";
import type { ZoneDef } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: Promise<{ id: string }> };

function slugKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || `zone-${Date.now().toString(36)}`
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** GET zones for the garden. */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
  return NextResponse.json({ zones: garden.brandKit.zones }, NO_STORE);
}

/**
 * POST pin a zone from live edit tap, or PATCH-like move.
 * body: { action: "pin"|"move"|"remove", x?, y?, label?, key? }
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garden = await getGardenByIdOrSlug(id);
  if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });

  try {
    const body = (await request.json()) as {
      action?: "pin" | "move" | "remove";
      x?: number;
      y?: number;
      label?: string;
      key?: string;
      prompt?: string;
    };
    const action = body.action || "pin";
    let zones = [...(garden.brandKit.zones ?? [])];

    if (action === "remove") {
      const key = body.key?.trim();
      if (!key) {
        return NextResponse.json({ error: "key required" }, { status: 400, ...NO_STORE });
      }
      zones = zones.filter((z) => z.key !== key);
    } else if (action === "move") {
      const key = body.key?.trim();
      if (!key || body.x == null || body.y == null) {
        return NextResponse.json(
          { error: "key, x, y required" },
          { status: 400, ...NO_STORE }
        );
      }
      zones = zones.map((z) =>
        z.key === key ? { ...z, x: clamp01(Number(body.x)), y: clamp01(Number(body.y)) } : z
      );
    } else {
      // pin
      if (body.x == null || body.y == null) {
        return NextResponse.json({ error: "x and y required" }, { status: 400, ...NO_STORE });
      }
      const label = (body.label?.trim() || `Place ${zones.length + 1}`).slice(0, 48);
      let key = body.key?.trim() || slugKey(label);
      if (zones.some((z) => z.key === key)) {
        key = `${key}-${Date.now().toString(36).slice(-3)}`;
      }
      const zone: ZoneDef = {
        key,
        label,
        x: clamp01(Number(body.x)),
        y: clamp01(Number(body.y)),
        hit: { type: "circle", r: 0.08 },
        prompt: body.prompt?.trim() || `Plant a seed in ${label}.`,
        ctaLabel: "Plant a seed",
        blurb: null,
        logoUrl: null,
        sponsorKey: null,
        inputPlaceholder: "Type your response…",
      };
      zones.push(zone);
    }

    const updated = await updateGarden(garden.id, { brandKit: { zones } });
    return NextResponse.json(
      { zones: updated?.brandKit.zones ?? zones, garden: updated },
      NO_STORE
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Zone update failed" },
      { status: 400, ...NO_STORE }
    );
  }
}
