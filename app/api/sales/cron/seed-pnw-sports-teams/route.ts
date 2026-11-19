import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getPnwSportsPartnerTeamsSeedStatus,
  seedPnwSportsPartnerTeams,
} from "@/lib/sales/seed/pnw-sports-teams";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Idempotent seed of Seattle & Pacific Northwest sports partner teams
 * (pro, minor league / USL / WHL / NWSL / MLR / MLC / PWHL, and PNW universities)
 * with Hunter-verified contacts and Fan Chant drafts.
 *
 * GET ?status=1 — public progress check (no email addresses).
 * GET/POST with Bearer CRON_SECRET — execute seed and push top priority drafts into Gmail Drafts.
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
      return NextResponse.json(await getPnwSportsPartnerTeamsSeedStatus());
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

    const result = await seedPnwSportsPartnerTeams({ force, pushGmailDrafts: 15 });
    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
