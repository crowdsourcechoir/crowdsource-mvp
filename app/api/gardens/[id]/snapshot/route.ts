import { NextResponse } from "next/server";
import { getGardenSnapshot } from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: Request, context: Ctx) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const chapterId = searchParams.get("chapterId");
    const eventId = searchParams.get("eventId");
    const snapshot = await getGardenSnapshot({
      gardenIdOrSlug: context.params.id,
      deviceId,
      chapterId,
      eventId,
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=5",
        ETag: `"v${snapshot.garden.worldVersion}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
