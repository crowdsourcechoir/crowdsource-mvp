import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { createPitch, listPitchAdmin } from "@/lib/pitches/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  const listed = await listPitchAdmin(organizationId);
  return NextResponse.json(listed, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    prompt?: unknown;
    live?: unknown;
    password?: unknown;
    organizationId?: unknown;
    category?: unknown;
    workstream?: unknown;
  };
  const created = await createPitch({
    name: typeof body.name === "string" ? body.name : "",
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    live: body.live !== false,
    password: typeof body.password === "string" ? body.password : "",
    organizationId: typeof body.organizationId === "string" ? body.organizationId : null,
    category: typeof body.category === "string" ? body.category : null,
    workstream: typeof body.workstream === "string" ? body.workstream : null,
  });
  if (!created.pitch) {
    return NextResponse.json({ error: created.error ?? "Could not create the pitch." }, { status: created.status });
  }
  return NextResponse.json({ pitch: created.pitch });
}
