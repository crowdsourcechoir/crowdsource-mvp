import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { pitchAuthToken, readPitchPasswordHash, verifyPitchPassword, writePitchPassword, PITCH_AUTH_COOKIE } from "@/lib/sobeca-pitch/access";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";

export const dynamic = "force-dynamic";

async function adminAllowed(): Promise<boolean> {
  if (!(await hasRootAuthPasswordConfigured())) return true;
  const token = (await cookies()).get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = await getRootAuthExpectedToken();
  return Boolean(token && expected && token === expected);
}

export async function GET() {
  if (!(await adminAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const hash = await readPitchPasswordHash();
  return NextResponse.json({ protected: Boolean(hash) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!(await adminAllowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown; clear?: boolean };
  if (body.clear) {
    const written = await writePitchPassword(null);
    if (written.error) return NextResponse.json({ error: written.error }, { status: 503 });
    return NextResponse.json({ protected: false });
  }
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!password) {
    return NextResponse.json({ error: "Enter a password to protect the page." }, { status: 400 });
  }
  const written = await writePitchPassword(password);
  if (written.error) return NextResponse.json({ error: written.error }, { status: 503 });
  return NextResponse.json({ protected: true });
}

export async function POST(request: Request) {
  const hash = await readPitchPasswordHash();
  if (!hash) return NextResponse.json({ ok: true });
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyPitchPassword(password, hash)) {
    return NextResponse.json({ error: "That password did not match." }, { status: 401 });
  }
  (await cookies()).set(PITCH_AUTH_COOKIE, pitchAuthToken(hash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/sobeca-song-garden",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
