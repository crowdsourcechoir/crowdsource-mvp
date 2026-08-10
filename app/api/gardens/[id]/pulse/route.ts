import { NextResponse } from "next/server";
import {
  effectCelebrationLine,
  isContributionKind,
} from "@/lib/song-garden-v2/garden/types";
import { recordBetweenShowPulse } from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Between-show / Fans contribution pulse for a live garden (`/g/[slug]`).
 * Optional zoneKey scopes the mark onto the schematic participation map.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      deviceId?: string;
      kind?: string;
      note?: string;
      zoneKey?: string;
    };
    const deviceId =
      typeof body.deviceId === "string" && /^dev_[a-zA-Z0-9_-]{8,64}$/.test(body.deviceId.trim())
        ? body.deviceId.trim()
        : null;
    const kind = isContributionKind(body.kind) ? body.kind : "text";

    const result = await recordBetweenShowPulse({
      gardenIdOrSlug: context.params.id,
      kind,
      deviceId,
      note: typeof body.note === "string" ? body.note : null,
      zoneKey: typeof body.zoneKey === "string" ? body.zoneKey : null,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Garden is not accepting contributions (or zoneKey is invalid)." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      worldVersion: result.worldVersion,
      gardenEffects: result.effects,
      gardenCelebrationLine: effectCelebrationLine(result.effects),
      energy: result.garden.worldState.energy,
      zones: result.garden.worldState.zones,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
