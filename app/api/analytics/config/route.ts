import { NextResponse } from "next/server";
import { measurementIdFrom } from "@/lib/analytics/model";
import { signedInOwner } from "@/lib/operators/current";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

function resolveId(stored: string | null): string | null {
  return stored || measurementIdFrom(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
}

export async function GET() {
  const current = await readWorkspaceSettings();
  return NextResponse.json(
    { gaMeasurementId: resolveId(current.settings.gaMeasurementId) },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}

export async function PATCH(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { gaMeasurementId?: unknown };
  const gaMeasurementId = measurementIdFrom(body.gaMeasurementId);
  if (typeof body.gaMeasurementId === "string" && body.gaMeasurementId.trim() && !gaMeasurementId) {
    return NextResponse.json({ error: "Use a GA4 measurement id such as G-XXXXXXXX." }, { status: 400 });
  }
  const written = await writeWorkspaceSettings({ gaMeasurementId });
  if (written.error) return NextResponse.json({ error: written.error }, { status: 503 });
  return NextResponse.json({ gaMeasurementId: resolveId(written.settings.gaMeasurementId) });
}
