import { NextResponse } from "next/server";
import { slides } from "@/app/sobeca-song-garden/content";
import { signedInOwner } from "@/lib/operators/current";
import { applyStoredCopy, resolveSongGardenPitch } from "@/lib/sobeca-pitch/copy";
import { passwordHashFrom } from "@/lib/sobeca-pitch/access";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const current = await resolveSongGardenPitch();
  return NextResponse.json(
    { slides: current.slides, copyColor: current.copyColor, defaults: slides },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    slides?: unknown;
    reset?: boolean;
  };
  const current = await readWorkspaceSettings({ skipCache: true });
  const passwordHash = passwordHashFrom(current.settings.songGarden);
  const slidesOnly = body.reset ? undefined : applyStoredCopy({ slides: body.slides }).slides;
  const songGarden =
    slidesOnly === undefined && !passwordHash
      ? null
      : {
          ...(slidesOnly !== undefined ? { slides: slidesOnly } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        };
  const written = await writeWorkspaceSettings({ songGarden });
  if (written.error) {
    return NextResponse.json({ error: written.error }, { status: 503 });
  }
  const saved = applyStoredCopy(written.settings.songGarden);
  return NextResponse.json({ slides: saved.slides, copyColor: saved.copyColor });
}
