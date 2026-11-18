import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getHunterSweepStatus,
  runHunterLeadSweep,
} from "@/lib/sales/enrichment/hunter-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

function cronBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

/**
 * Automated Hunter enrichment sweep across new leads and weak generic-inbox leads.
 * Self-chains while eligible leads and credit headroom remain.
 *
 * GET ?status=1 — public read-only progress + Hunter credit summary (no emails).
 * GET/POST with Bearer CRON_SECRET — execute batch.
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
      return NextResponse.json(await getHunterSweepStatus());
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Server error" },
        { status: 500 }
      );
    }
  }
  return runSweep(request);
}

export async function POST(request: Request) {
  return runSweep(request);
}

async function runSweep(request: Request) {
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
    const url = new URL(request.url);
    const chainDepth = Number(url.searchParams.get("continue") ?? "0") || 0;
    let force = url.searchParams.get("force") === "1";
    let maxOrgs: number | undefined;

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        force?: boolean;
        maxOrgs?: number;
      };
      if (body.force !== undefined) force = Boolean(body.force);
      if (typeof body.maxOrgs === "number") maxOrgs = body.maxOrgs;
    }

    const result = await runHunterLeadSweep({
      maxOrgs,
      force,
      ensureRecentSeeds: chainDepth === 0,
    });

    let chained = false;
    if (!result.done && result.batchAttempted > 0 && chainDepth < 25) {
      chained = true;
      const next = new URL("/api/sales/cron/hunter-sweep", cronBaseUrl(request));
      next.searchParams.set("continue", String(chainDepth + 1));
      const runNext = async () => {
        try {
          await fetch(next.toString(), {
            method: "GET",
            headers: { Authorization: `Bearer ${cronSecret}` },
          }).then((r) => r.text());
        } catch (err) {
          console.error("[hunter-sweep] continuation failed:", err);
        }
      };
      try {
        waitUntil(runNext());
      } catch {
        void runNext();
      }
    }

    return NextResponse.json({
      chainDepth,
      chained,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
