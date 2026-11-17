import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPitchPassword } from "@/lib/sobeca-pitch/access";
import { accountGateCookie } from "@/lib/spaces/gate";
import { readWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

type RouteContext = { params: { orgSlug: string } };

export async function POST(request: Request, { params }: RouteContext) {
  const slug = params.orgSlug.trim().toLowerCase();
  const stored = await readWorkspaceSettings({ skipCache: true });
  const account = stored.settings.clientSpaces.accounts.find((item) => item.slug === slug);
  if (!account) return NextResponse.json({ error: "That page was not found." }, { status: 404 });
  if (!account.passwordHash) return NextResponse.json({ ok: true });
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyPitchPassword(password, account.passwordHash)) {
    return NextResponse.json({ error: "That password did not match." }, { status: 401 });
  }
  const cookie = accountGateCookie({
    organizationId: account.organizationId,
    slug: account.slug,
    passwordHash: account.passwordHash,
  });
  (await cookies()).set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: cookie.path,
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true });
}
