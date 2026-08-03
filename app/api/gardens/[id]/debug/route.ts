import { NextResponse } from "next/server";
import {
  getGardenByIdOrSlug,
  listChapters,
  listRecentMutations,
} from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

/** Admin debugger payload: live state + recent mutation log. */
export async function GET(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") ?? 40);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 40;

    const [chapters, mutations] = await Promise.all([
      listChapters(garden.id),
      listRecentMutations(garden.id, limit),
    ]);

    return NextResponse.json(
      {
        garden: {
          id: garden.id,
          slug: garden.slug,
          title: garden.title,
          status: garden.status,
          worldVersion: garden.worldVersion,
          updatedAt: garden.updatedAt,
        },
        worldState: garden.worldState,
        mutationPolicy: garden.mutationPolicy,
        chapters,
        recentMutations: mutations,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
