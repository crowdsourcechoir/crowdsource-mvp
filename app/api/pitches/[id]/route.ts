import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { loadPitch, updatePitch } from "@/lib/pitches/service";
import { toAdmin } from "@/lib/pitches/model";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

function knownId(id: string): boolean {
  return /^[a-z0-9_-]{1,80}$/.test(id);
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!knownId(params.id)) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  const pitch = await loadPitch(params.id);
  if (!pitch || pitch.id !== params.id) {
    return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  }
  return NextResponse.json({ pitch: toAdmin(pitch) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!knownId(params.id)) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    prompt?: unknown;
    live?: unknown;
    slides?: unknown;
    reset?: boolean;
  };
  const updated = await updatePitch(params.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    live: typeof body.live === "boolean" ? body.live : undefined,
    slides: Array.isArray(body.slides) ? body.slides : undefined,
    reset: body.reset === true,
  });
  if (!updated.pitch) {
    return NextResponse.json({ error: updated.error ?? "Could not save the pitch." }, { status: updated.status });
  }
  return NextResponse.json({ pitch: updated.pitch });
}
