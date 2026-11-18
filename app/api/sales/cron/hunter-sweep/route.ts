import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/sales/db/client";
import {
  getHunterSweepStatus,
  runHunterLeadSweep,
} from "@/lib/sales/enrichment/hunter-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

const MAX_CHAIN_DEPTH = 1;

function cronBaseUrl(request: Request): string {
  const origin = new URL(request.url).origin;
  if (origin && !origin.includes("localhost")) return origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return origin;
}

async function kickNextBatch(baseUrl: string, cronSecret: string, nextDepth: number): Promise<void> {
  const next = new URL("/api/sales/cron/hunter-sweep", baseUrl);
  next.searchParams.set("continue", String(nextDepth));
  try {
    const res = await fetch(next.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    await res.text();
  } catch (err) {
    console.error("[hunter-sweep] continuation failed:", err);
  }
}

/**
 * Automated Hunter enrichment sweep across new leads and weak generic-inbox leads.
 * Continuation hops (`continue >= 1`) return 202 immediately and run inside `waitUntil`
 * so the parent invocation never blocks on the child's 3-minute batch.
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

  const baseUrl = cronBaseUrl(request);

  if (chainDepth >= 1 && request.method === "GET") {
    const backgroundWork = async () => {
      try {
        const result = await runHunterLeadSweep({
          maxOrgs,
          force: false,
          ensureRecentSeeds: false,
        });
        if (!result.done && result.batchAttempted > 0 && chainDepth < MAX_CHAIN_DEPTH) {
          await kickNextBatch(baseUrl, cronSecret, chainDepth + 1);
        }
      } catch (err) {
        console.error("[hunter-sweep] background hop failed:", err);
      }
    };
    waitUntil(backgroundWork());
    return NextResponse.json({ accepted: true, chainDepth }, { status: 202 });
  }

  try {
    const result = await runHunterLeadSweep({
      maxOrgs,
      force,
      ensureRecentSeeds: chainDepth === 0,
    });

    let chained = false;
    if (!result.done && result.batchAttempted > 0 && chainDepth < MAX_CHAIN_DEPTH) {
      chained = true;
      waitUntil(kickNextBatch(baseUrl, cronSecret, chainDepth + 1));
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
