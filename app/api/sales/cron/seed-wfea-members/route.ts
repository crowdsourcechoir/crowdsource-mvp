import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getWfeaMembersSeedStatus,
  seedWfeaMembers,
} from "@/lib/sales/seed/seed-wfea-members";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Idempotent seed of WFEA member directory → orgs (+ contacts) + queue for sales targets.
 * Re-runs are no-ops once import_metadata.wfeaMembersSeeded is set.
 *
 * GET ?status=1 — public progress check (names + counts only).
 * Body/query force=1 — re-seed (requires Bearer CRON_SECRET).
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
      const status = await getWfeaMembersSeedStatus();
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

    const result = await seedWfeaMembers({ force });
    const done =
      result.errors.filter((e) => !e.error.startsWith("enqueue:")).length === 0 &&
      result.skippedAlreadySeeded + result.createdOrgs + result.updatedOrgs === result.attempted;

    return NextResponse.json({
      ok: result.errors.filter((e) => !e.error.startsWith("enqueue:")).length === 0,
      done,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
