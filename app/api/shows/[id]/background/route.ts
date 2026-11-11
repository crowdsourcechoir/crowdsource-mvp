import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { resolveShowBackground } from "@/lib/show-slides/background";
import { loadShow } from "@/lib/show-slides/service";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: Request, context: Ctx) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const show = await loadShow(context.params.id);
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  const url = new URL(request.url);
  const draft = {
    ...show,
    gardenId: url.searchParams.has("gardenId") ? url.searchParams.get("gardenId") || null : show.gardenId,
    bloomId: url.searchParams.has("bloomId") ? url.searchParams.get("bloomId") || null : show.bloomId,
  };
  const background = await resolveShowBackground(draft);
  return NextResponse.json({ background }, { headers: { "Cache-Control": "no-store" } });
}
