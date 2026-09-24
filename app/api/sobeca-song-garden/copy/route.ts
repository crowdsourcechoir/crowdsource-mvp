import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { slides } from "@/app/sobeca-song-garden/content";
import { applyStoredCopy, resolveSongGardenPitch, safeCopyColor } from "@/lib/sobeca-pitch/copy";
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
  const current = await resolveSongGardenPitch();
  return NextResponse.json(
    { slides: current.slides, copyColor: current.copyColor, defaults: slides },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request) {
  if (!(await allowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    slides?: unknown;
    copyColor?: unknown;
    reset?: boolean;
  };
  const songGarden = body.reset
    ? null
    : {
        slides: applyStoredCopy(body.slides).slides,
        copyColor: safeCopyColor(body.copyColor),
      };
  const written = await writeWorkspaceSettings({ songGarden });
  if (written.error) {
    return NextResponse.json({ error: written.error }, { status: 503 });
  }
  const saved = applyStoredCopy(written.settings.songGarden);
  return NextResponse.json({ slides: saved.slides, copyColor: saved.copyColor });
}
