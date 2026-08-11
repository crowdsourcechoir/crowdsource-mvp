import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { generateMapPlateDraft } from "@/lib/song-garden-v2/garden/map-plate";
import { isRunwayConfigured, RunwayError } from "@/lib/song-garden-v2/runway";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

/**
 * Generate a season map plate draft via Runway (M1 + M2 layout-guided).
 * Does not change live `heroArtworkUrl` until pin. Zone hits never modified.
 */
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

    let body: {
      vibePrompt?: string;
      venueNotes?: string;
      referenceUrls?: string[];
      seasonLabel?: string;
      layoutGuided?: boolean;
      twinMode?: boolean;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    const result = await generateMapPlateDraft(garden, {
      vibePrompt: body.vibePrompt,
      venueNotes: body.venueNotes,
      referenceUrls: body.referenceUrls,
      seasonLabel: body.seasonLabel,
      layoutGuided: body.layoutGuided,
      twinMode: body.twinMode,
    });

    return NextResponse.json(
      {
        garden: result.garden,
        draftUrl: result.draftUrl,
        promptText: result.promptText,
        layoutGuided: result.layoutGuided,
        twinMode: result.twinMode,
        layoutSchematicUrl: result.layoutSchematicUrl,
      },
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
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
