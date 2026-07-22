import { NextResponse } from "next/server";
import { getRunwayAccountStatus, isRunwayConfigured, RunwayError } from "@/lib/song-garden-v2/runway";

export const dynamic = "force-dynamic";

/**
 * Free to call — GET /v1/organization does not spend Runway credits. Lets the admin UI show
 * "add credits before generating" without any risk of an accidental paid call.
 */
export async function GET() {
  if (!isRunwayConfigured()) {
    return NextResponse.json({ configured: false });
  }

  try {
    const status = await getRunwayAccountStatus();
    return NextResponse.json({ configured: true, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Runway.";
    const code = err instanceof RunwayError ? err.code : "api_error";
    return NextResponse.json({ configured: true, error: message, code }, { status: 200 });
  }
}
