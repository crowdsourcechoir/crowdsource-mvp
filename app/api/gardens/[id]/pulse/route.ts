import { NextResponse } from "next/server";
import {
  effectCelebrationLine,
  isContributionKind,
} from "@/lib/song-garden-v2/garden/types";
import { recordBetweenShowPulse } from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Between-show contribution pulse for a live garden (`/g/[slug]`).
 * Does not require an open chapter.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      deviceId?: string;
      kind?: string;
      note?: string;
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
    });

    if (!result) {
      return NextResponse.json(
        { error: "Garden is not accepting between-show contributions." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      worldVersion: result.worldVersion,
      gardenEffects: result.effects,
      gardenCelebrationLine: effectCelebrationLine(result.effects),
      energy: result.garden.worldState.energy,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
