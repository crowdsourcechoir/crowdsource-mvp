import { NextResponse } from "next/server";
import {
  getGardenByIdOrSlug,
  listEditions,
  pinGardenEdition,
} from "@/lib/song-garden-v2/garden/store";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const editions = await listEditions(garden.id);
    return NextResponse.json({ editions }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pin current (or historical) world state as a merch edition. */
export async function POST(request: Request, context: Ctx) {
  try {
    const body = (await request.json()) as {
      slug?: string;
      label?: string;
      at?: string | null;
      version?: number | null;
    };
    if (!body.slug?.trim() || !body.label?.trim()) {
      return NextResponse.json({ error: "slug and label are required." }, { status: 400 });
    }
    const edition = await pinGardenEdition({
      gardenIdOrSlug: context.params.id,
      slug: body.slug,
      label: body.label,
      at: body.at,
      version: body.version,
    });
    return NextResponse.json({ edition }, { status: 201, ...NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /already exists|not found/i.test(message)
      ? /not found/i.test(message)
        ? 404
        : 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
