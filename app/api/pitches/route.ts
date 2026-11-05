import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { createPitch, listPitchAdmin } from "@/lib/pitches/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const listed = await listPitchAdmin();
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
  };
  const created = await createPitch({
    name: typeof body.name === "string" ? body.name : "",
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    live: body.live !== false,
    password: typeof body.password === "string" ? body.password : "",
  });
  if (!created.pitch) {
    return NextResponse.json({ error: created.error ?? "Could not create the pitch." }, { status: created.status });
  }
  return NextResponse.json({ pitch: created.pitch });
}
