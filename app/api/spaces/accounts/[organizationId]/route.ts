import { NextResponse } from "next/server";
import { saveAccount, spaceEditorAllowed, listSpaces } from "@/lib/spaces/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: { organizationId: string } };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    slug?: unknown;
    password?: unknown;
    clearPassword?: unknown;
  };
  const saved = await saveAccount(params.organizationId, {
    slug: typeof body.slug === "string" ? body.slug : undefined,
    password: typeof body.password === "string" ? body.password : undefined,
    clearPassword: body.clearPassword === true,
  });
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: saved.status });
  const listed = await listSpaces();
  return NextResponse.json(listed);
}
