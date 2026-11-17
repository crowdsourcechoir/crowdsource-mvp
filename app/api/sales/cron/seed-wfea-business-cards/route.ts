import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getWfeaBusinessCardsSeedStatus,
  seedWfeaBusinessCards,
} from "@/lib/sales/seed/wfea-business-cards";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Idempotent seed of Kylie Martinez (Friends of Waterfront Park),
 * Deci Evans (Kind + Co Events), and Gazala Uradnik (GFS Events)
 * from their business cards into Interest + approval queue.
 *
 * GET ?status=1 — public read-only progress check (no emails).
 * GET/POST with Bearer CRON_SECRET — execute seed.
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
      return NextResponse.json(await getWfeaBusinessCardsSeedStatus());
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
    let force = false;
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { force?: boolean };
      force = Boolean(body.force);
    } else {
      force = new URL(request.url).searchParams.get("force") === "1";
    }

    const result = await seedWfeaBusinessCards({ force });
    return NextResponse.json({
      ok: result.errors.length === 0,
      done:
        result.errors.length === 0 &&
        result.enqueued + result.skippedAlreadySeeded === result.attempted,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
