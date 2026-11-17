import { NextResponse } from "next/server";
import { deleteRow, listSpaces, saveRow, spaceEditorAllowed } from "@/lib/spaces/service";
import { SPACE_ROLES, type SpaceRole } from "@/lib/spaces/model";

export const dynamic = "force-dynamic";

type RouteContext = { params: { dealId: string } };

function roleFrom(value: unknown): SpaceRole | null {
  return SPACE_ROLES.find((role) => role === value) ?? null;
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    role?: unknown;
    title?: unknown;
    body?: unknown;
    pathSlug?: unknown;
    linkUrl?: unknown;
    linkLabel?: unknown;
    published?: unknown;
    pitchId?: unknown;
    createPitch?: unknown;
    remove?: unknown;
  };
  const role = roleFrom(body.role);
  if (!role) return NextResponse.json({ error: "Choose a page." }, { status: 400 });
  if (body.remove === true) {
    const removed = await deleteRow(params.dealId, role);
    if (removed.error) return NextResponse.json({ error: removed.error }, { status: removed.status });
  } else {
    const saved = await saveRow(params.dealId, {
      dealId: params.dealId,
      role,
      title: typeof body.title === "string" ? body.title : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      pathSlug: body.pathSlug === null ? null : typeof body.pathSlug === "string" ? body.pathSlug : undefined,
      linkUrl: body.linkUrl === null ? null : typeof body.linkUrl === "string" ? body.linkUrl : undefined,
      linkLabel: body.linkLabel === null ? null : typeof body.linkLabel === "string" ? body.linkLabel : undefined,
      published: typeof body.published === "boolean" ? body.published : undefined,
      pitchId: body.pitchId === null ? null : typeof body.pitchId === "string" ? body.pitchId : undefined,
      createPitch: body.createPitch === true,
    });
    if (saved.error) return NextResponse.json({ error: saved.error }, { status: saved.status });
  }
  const listed = await listSpaces();
  return NextResponse.json(listed);
}
