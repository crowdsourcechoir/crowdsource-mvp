import { NextResponse } from "next/server";
import { getEventGardenSnapshot } from "@/lib/song-garden-v2/garden/store";

import { PUBLIC_SNAPSHOT_CACHE } from "@/lib/http/public-cache";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: Request, context: Ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const snapshot = await getEventGardenSnapshot({
      eventId: context.params.id,
      deviceId,
    });
    if (!snapshot) {
      return NextResponse.json(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": PUBLIC_SNAPSHOT_CACHE,
        ETag: `"v${snapshot.garden.worldVersion}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
