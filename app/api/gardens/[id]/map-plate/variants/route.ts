import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import {
  generateMapPlateVariant,
  setActiveMapPlateVariant,
} from "@/lib/song-garden-v2/garden/map-plate";
import {
  MAP_PLATE_VARIANT_KEYS,
  type MapPlateVariantKey,
} from "@/lib/song-garden-v2/garden/types";
import { isRunwayConfigured, RunwayError } from "@/lib/song-garden-v2/runway";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

function isVariantKey(v: unknown): v is MapPlateVariantKey {
  return typeof v === "string" && MAP_PLATE_VARIANT_KEYS.includes(v as MapPlateVariantKey);
}

/** M4 — generate a matchday variant still (optional motion) from the pinned plate. */
export async function POST(request: Request, context: Ctx) {
  try {
    if (!isRunwayConfigured()) {
      return NextResponse.json(
        {
          error:
            "Runway is not configured. Add RUNWAYML_API_SECRET to env and restart.",
          code: "not_configured",
        },
        { status: 503, ...NO_STORE }
      );
    }

    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    let body: { key?: string; withMotion?: boolean } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    if (!isVariantKey(body.key) || body.key === "default") {
      return NextResponse.json(
        {
          error:
            "key must be one of: kickoff, goal, halftime, rivalry, night",
        },
        { status: 400, ...NO_STORE }
      );
    }

    const result = await generateMapPlateVariant(garden, {
      key: body.key,
      withMotion: body.withMotion === true,
    });

    return NextResponse.json(
      { garden: result.garden, variant: result.variant },
      NO_STORE
    );
  } catch (err) {
    if (err instanceof RunwayError) {
      const status =
        err.code === "not_configured"
          ? 503
          : err.code === "insufficient_credits"
            ? 402
            : err.code === "rate_limited"
              ? 429
              : 502;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status, ...NO_STORE }
      );
    }
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("Pin a season") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, ...NO_STORE });
  }
}

/** M4 — set which variant `/g` shows (or null/default for season plate). */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    let body: { activeVariantKey?: string | null } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const raw = body.activeVariantKey;
    let key: MapPlateVariantKey | null = null;
    if (raw == null || raw === "" || raw === "default") {
      key = null;
    } else if (isVariantKey(raw)) {
      key = raw;
    } else {
      return NextResponse.json({ error: "Invalid activeVariantKey" }, { status: 400, ...NO_STORE });
    }

    const updated = await setActiveMapPlateVariant(garden, key);
    return NextResponse.json({ garden: updated }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = message.includes("not generated") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, ...NO_STORE });
  }
}
