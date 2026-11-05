import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { verifyPitchPassword } from "@/lib/sobeca-pitch/access";
import { pitchGateCookie } from "@/lib/pitches/gate";
import { loadPitch, setPitchPassword } from "@/lib/pitches/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

function knownId(id: string): boolean {
  return /^[a-z0-9_-]{1,80}$/.test(id);
}

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!knownId(params.id)) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  const pitch = await loadPitch(params.id);
  if (!pitch || pitch.id !== params.id) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  return NextResponse.json(
    { protected: Boolean(pitch.passwordHash), live: pitch.live },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!knownId(params.id)) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { password?: unknown; clear?: boolean };
  if (body.clear) {
    const cleared = await setPitchPassword(params.id, null);
    if (cleared.error) return NextResponse.json({ error: cleared.error }, { status: cleared.status });
    return NextResponse.json({ protected: false });
  }
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!password) {
    return NextResponse.json({ error: "Enter a password to protect the page." }, { status: 400 });
  }
  const saved = await setPitchPassword(params.id, password);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json({ protected: true });
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!knownId(params.id)) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  const pitch = await loadPitch(params.id);
  if (!pitch || pitch.id !== params.id) return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  if (!pitch.passwordHash) return NextResponse.json({ ok: true });
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyPitchPassword(password, pitch.passwordHash)) {
    return NextResponse.json({ error: "That password did not match." }, { status: 401 });
  }
  const cookie = pitchGateCookie({ id: pitch.id, href: pitch.href, passwordHash: pitch.passwordHash });
  (await cookies()).set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookie.path,
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
