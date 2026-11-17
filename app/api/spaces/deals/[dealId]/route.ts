import { NextResponse } from "next/server";
import { listSpaces, saveDeal, spaceEditorAllowed } from "@/lib/spaces/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: { dealId: string } };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    slug?: unknown;
    current?: unknown;
  };
  const saved = await saveDeal(params.dealId, {
    name: typeof body.name === "string" ? body.name : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    current: body.current === true ? true : undefined,
  });
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: saved.status });
  const listed = await listSpaces();
  return NextResponse.json(listed);
}
