import { NextResponse } from "next/server";
import { runDiscoveryRun } from "@/lib/sales/discovery/run-discovery";
import { normalizeDiscoveryOptions, type DiscoveryMode } from "@/lib/sales/discovery/presets";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual trigger — optional JSON body for focus mode / cities / year / custom focus. */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const options = normalizeDiscoveryOptions({
      mode: body.mode as DiscoveryMode | undefined,
      cities: Array.isArray(body.cities) ? body.cities.map(String) : undefined,
      focus: typeof body.focus === "string" ? body.focus : undefined,
      year: typeof body.year === "number" ? body.year : body.year != null ? Number(body.year) : undefined,
      maxNewOrganizations:
        typeof body.maxNewOrganizations === "number"
          ? body.maxNewOrganizations
          : body.maxNewOrganizations != null
            ? Number(body.maxNewOrganizations)
            : undefined,
      maxQueries:
        typeof body.maxQueries === "number" ? body.maxQueries : body.maxQueries != null ? Number(body.maxQueries) : undefined,
    });
    const summary = await runDiscoveryRun("manual", options);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
