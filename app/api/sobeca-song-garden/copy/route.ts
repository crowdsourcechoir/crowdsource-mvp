import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { slides } from "@/app/sobeca-song-garden/content";
import { applyStoredCopy, resolveSongGardenSlides } from "@/lib/sobeca-pitch/copy";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";
import { writeWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

async function allowed(): Promise<boolean> {
  if (!(await hasRootAuthPasswordConfigured())) return true;
  const token = (await cookies()).get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = await getRootAuthExpectedToken();
  return Boolean(token && expected && token === expected);
}

export async function GET() {
  if (!(await allowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const current = await resolveSongGardenSlides();
  return NextResponse.json({ slides: current, defaults: slides }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!(await allowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { slides?: unknown; reset?: boolean };
  const songGarden = body.reset ? null : applyStoredCopy(body.slides);
  const written = await writeWorkspaceSettings({ songGarden });
  if (written.error) {
    return NextResponse.json({ error: written.error }, { status: 503 });
  }
  return NextResponse.json({ slides: applyStoredCopy(written.settings.songGarden) });
}
