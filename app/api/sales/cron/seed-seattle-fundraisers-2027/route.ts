import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getSeattleFundraisers2027SeedStatus,
  seedSeattleFundraisers2027,
} from "@/lib/sales/seed/seed-seattle-fundraisers-2027";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Idempotent seed of Seattle-area auction/gala shortlist + doorway contacts.
 * GET ?status=1 — progress (names + counts).
 * POST/GET with Bearer CRON_SECRET — run seed (force=1 to re-seed).
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
      const status = await getSeattleFundraisers2027SeedStatus();
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
    let force = false;
    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { force?: boolean };
      force = Boolean(body.force);
    } else {
      force = new URL(request.url).searchParams.get("force") === "1";
    }

    const result = await seedSeattleFundraisers2027({ force });
    return NextResponse.json({
      ok: result.errors.length === 0,
      done:
        result.errors.length === 0 &&
        result.createdOrgs + result.updatedOrgs + result.skippedAlreadySeeded === result.attempted,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
