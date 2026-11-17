import { NextResponse } from "next/server";
import { listSpaces, openWorkspace, spaceEditorAllowed } from "@/lib/spaces/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const listed = await listSpaces();
  return NextResponse.json(listed, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: unknown;
    slug?: unknown;
    password?: unknown;
    dealName?: unknown;
    dealSlug?: unknown;
    salesOpportunityId?: unknown;
  };
  const opened = await openWorkspace({
    organizationId: typeof body.organizationId === "string" ? body.organizationId : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    password: typeof body.password === "string" ? body.password : "",
    dealName: typeof body.dealName === "string" ? body.dealName : "",
    dealSlug: typeof body.dealSlug === "string" ? body.dealSlug : "",
    salesOpportunityId: typeof body.salesOpportunityId === "string" ? body.salesOpportunityId : null,
  });
  if (opened.error) return NextResponse.json({ error: opened.error }, { status: opened.status });
  const listed = await listSpaces();
  return NextResponse.json(listed);
}
