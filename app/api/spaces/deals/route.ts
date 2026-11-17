import { NextResponse } from "next/server";
import { listSpaces, openDeal, spaceEditorAllowed } from "@/lib/spaces/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await spaceEditorAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: unknown;
    name?: unknown;
    slug?: unknown;
    salesOpportunityId?: unknown;
    current?: unknown;
  };
  const opened = await openDeal({
    organizationId: typeof body.organizationId === "string" ? body.organizationId : "",
    name: typeof body.name === "string" ? body.name : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    salesOpportunityId: typeof body.salesOpportunityId === "string" ? body.salesOpportunityId : null,
    current: body.current === true,
  });
  if (opened.error) return NextResponse.json({ error: opened.error }, { status: opened.status });
  const listed = await listSpaces();
  return NextResponse.json(listed);
}
