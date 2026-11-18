import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import { getVisitBellevueSeedStatus, seedVisitBellevuePartner } from "@/lib/sales/seed/visit-bellevue-partner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Visit Bellevue as a Partner in the queue, linked to the presentation and
 * the Bellevue pitch, then Gmail correspondence for the known addresses.
 *
 * GET ?status=1 — public progress (no email addresses).
 * GET/POST with Bearer CRON_SECRET — run the seed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    try {
      requireSupabaseAdmin();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Database not configured." },
        { status: 503 }
      );
    }
    try {
      const status = await getVisitBellevueSeedStatus();
      return NextResponse.json(status);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Server error" },
        { status: 500 }
      );
    }
  }
  return runSeed(request);
}

export async function POST(request: Request) {
  return runSeed(request);
}

async function runSeed(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const result = await seedVisitBellevuePartner();
    return NextResponse.json({ ok: result.gmail.errors.length === 0, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
