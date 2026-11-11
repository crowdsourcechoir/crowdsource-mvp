import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import type { ShowSlide } from "@/lib/show-slides/model";
import { deleteShow, loadShow, patchShow } from "@/lib/show-slides/service";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const show = await loadShow(context.params.id);
  if (!show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  return NextResponse.json({ show }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Ctx) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    gardenId?: unknown;
    bloomId?: unknown;
    slides?: unknown;
  };
  const patched = await patchShow(context.params.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    gardenId: body.gardenId === undefined ? undefined : typeof body.gardenId === "string" ? body.gardenId : null,
    bloomId: body.bloomId === undefined ? undefined : typeof body.bloomId === "string" ? body.bloomId : null,
    slides: Array.isArray(body.slides) ? (body.slides as ShowSlide[]) : undefined,
  });
  if (!patched.show) {
    return NextResponse.json({ error: patched.error ?? "Could not save the show." }, { status: patched.status });
  }
  return NextResponse.json({ show: patched.show }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, context: Ctx) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const removed = await deleteShow(context.params.id);
  if (removed.error) return NextResponse.json({ error: removed.error }, { status: removed.status });
  return NextResponse.json({ ok: true });
}
