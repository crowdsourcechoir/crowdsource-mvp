import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildVisit, isBotUserAgent } from "@/lib/analytics/model";
import { saveVisit } from "@/lib/analytics/store";
import { OPERATOR_COOKIE } from "@/lib/operators/session";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "csc_vid";
const SESSION_COOKIE = "csc_sid";
const ID_RE = /^[A-Za-z0-9-]{8,80}$/;

function headerValue(request: Request, name: string): string {
  const raw = request.headers.get(name) || "";
  try {
    return decodeURIComponent(raw).trim().slice(0, 80);
  } catch {
    return raw.trim().slice(0, 80);
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (isBotUserAgent(userAgent)) return new NextResponse(null, { status: 204 });

  const raw = await request.text();
  if (raw.length > 2000) return NextResponse.json({ error: "Visit payload is too large." }, { status: 413 });
  let body: { id?: unknown; path?: unknown; referrer?: unknown; ms?: unknown } = {};
  if (raw) {
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return NextResponse.json({ error: "That visit could not be recorded." }, { status: 400 });
    }
  }

  const jar = await cookies();
  const existingVisitor = jar.get(VISITOR_COOKIE)?.value;
  const existingSession = jar.get(SESSION_COOKIE)?.value;
  const vid = existingVisitor && ID_RE.test(existingVisitor) ? existingVisitor : crypto.randomUUID();
  const sid = existingSession && ID_RE.test(existingSession) ? existingSession : crypto.randomUUID();
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const event = buildVisit({
    id: body.id,
    path: body.path,
    host,
    referrer: body.referrer,
    ms: body.ms,
    vid,
    sid,
    country: headerValue(request, "x-vercel-ip-country"),
    region: headerValue(request, "x-vercel-ip-country-region"),
    city: headerValue(request, "x-vercel-ip-city"),
    userAgent,
    internal: Boolean(jar.get(OPERATOR_COOKIE)?.value),
    now: Date.now(),
  });

  const response = event
    ? await (async () => {
        const saved = await saveVisit(event);
        return NextResponse.json(
          { ok: saved.ok, error: saved.error },
          { status: saved.ok ? 200 : 202, headers: { "Cache-Control": "no-store" } }
        );
      })()
    : NextResponse.json({ error: "That visit could not be recorded." }, { status: 400 });

  response.cookies.set(VISITOR_COOKIE, vid, cookieOptions(60 * 60 * 24 * 365));
  response.cookies.set(SESSION_COOKIE, sid, cookieOptions(60 * 30));
  return response;
}
