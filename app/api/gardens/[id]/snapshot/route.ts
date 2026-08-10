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
    const at = searchParams.get("at");
    const versionRaw = searchParams.get("version");
    const version =
      versionRaw != null && versionRaw !== "" && Number.isFinite(Number(versionRaw))
        ? Number(versionRaw)
        : null;
    const snapshot = await getGardenSnapshot({
      gardenIdOrSlug: context.params.id,
      deviceId,
      chapterId,
      eventId,
      at,
      version,
    });
    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const etagBase = snapshot.asOf
      ? `hist-${snapshot.garden.worldVersion}-${snapshot.asOf}`
      : `v${snapshot.garden.worldVersion}`;
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": snapshot.asOf ? "public, max-age=30" : "public, max-age=5",
        ETag: `"${etagBase}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
