import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { createShowAdmin, listShowAdmin } from "@/lib/show-slides/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const listed = await listShowAdmin();
  return NextResponse.json(listed, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const created = await createShowAdmin(typeof body.name === "string" ? body.name : "");
  if (!created.show) {
    return NextResponse.json({ error: created.error ?? "Could not create the show." }, { status: created.status });
  }
  return NextResponse.json({ show: created.show });
}
