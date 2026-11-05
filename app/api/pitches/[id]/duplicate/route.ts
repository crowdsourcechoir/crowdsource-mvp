import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { duplicatePitchById } from "@/lib/pitches/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!/^[a-z0-9_-]{1,80}$/.test(params.id)) {
    return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  }
  const copied = await duplicatePitchById(params.id);
  if (!copied.pitch) {
    return NextResponse.json({ error: copied.error ?? "Could not duplicate the pitch." }, { status: copied.status });
  }
  return NextResponse.json({ pitch: copied.pitch });
}
