import { NextResponse } from "next/server";
import { createGarden, listGardens } from "@/lib/song-garden-v2/garden/store";
import type { BrandKit, GardenKind, GardenStatus, MutationPolicy } from "@/lib/song-garden-v2/garden/types";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const gardens = await listGardens();
    return NextResponse.json({ gardens }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      slug?: string;
      title?: string;
      kind?: GardenKind;
      status?: GardenStatus;
      brandKit?: Partial<BrandKit>;
      mutationPolicy?: Partial<MutationPolicy>;
    };
    if (!body.slug?.trim() || !body.title?.trim()) {
      return NextResponse.json({ error: "slug and title are required." }, { status: 400 });
    }
    const garden = await createGarden({
      slug: body.slug,
      title: body.title,
      kind: body.kind,
      status: body.status,
      brandKit: body.brandKit,
      mutationPolicy: body.mutationPolicy,
    });
    return NextResponse.json({ garden }, { status: 201, ...NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
