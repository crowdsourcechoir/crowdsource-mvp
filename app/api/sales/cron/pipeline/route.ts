import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";
import { scheduleDigestContinuation } from "@/lib/sales/digest/continue";
import { fillQueueFromAwaitingContact } from "@/lib/sales/pipeline/fill-queue";
import { runPipelineBatch } from "@/lib/sales/pipeline/run-pipeline-batch";
import { drainAnthemPricing } from "@/lib/sales/pricing/evaluate";
import { seedNationalKeynoteTargets } from "@/lib/sales/prospecting/seed-national-targets";
import { refreshAutoSendPlan, tickAutoSend } from "@/lib/sales/autosend/tick";
import { listUnprocessedOrganizations } from "@/lib/sales/db/organizations";
import { seedAmplifyConferences2027 } from "@/lib/sales/seed/seed-amplify-conferences-2027";
import { seedElevateVibeCreateProspects } from "@/lib/sales/seed/seed-elevate-vibe-create-prospects";
import { seedBallardFcConversation } from "@/lib/sales/seed/ballard-fc-conversation";
import { seedResendForward } from "@/lib/sales/seed/resend-forward";
import { seedSeattleFundraisers2027 } from "@/lib/sales/seed/seed-seattle-fundraisers-2027";
import { seedKey2027Prospects } from "@/lib/sales/seed/seed-key-2027-prospects";

export const dynamic = "force-dynamic";
export const maxDuration = 290;

function cronBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

/**
 * Continuous pipeline cron: seeds curated $15k+ national keynote targets, runs the 10-stage
 * research/enrichment/scoring/drafting pipeline, prices new opportunities, refreshes the 30-day
 * $15k+ lineup, pre-loads Gmail drafts, and self-chains while unprocessed Priority A leads remain.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const chainDepth = Number(url.searchParams.get("continue") ?? "0") || 0;

    let nationalSeed = null;
    let key2027Seed = null;
    if (chainDepth === 0) {
      try {
        key2027Seed = await seedKey2027Prospects();
      } catch (err) {
        key2027Seed = { error: err instanceof Error ? err.message : "Key 2027 prospects seed failed" };
      }
      try {
        nationalSeed = await seedNationalKeynoteTargets({ runPipeline: false });
      } catch (err) {
        nationalSeed = {
          error: err instanceof Error ? err.message : "National keynote seed failed",
        };
      }
    }

    let amplifySeed = null;
    let elevateVibeCreateSeed = null;
    let ballardFcSeed = null;
    let seattleFundraisersSeed = null;
    let resendForwardSeed = null;
    if (chainDepth === 0) {
      try {
        amplifySeed = await seedAmplifyConferences2027();
      } catch (err) {
        amplifySeed = { error: err instanceof Error ? err.message : "Amplify 2027 seed failed" };
      }
      try {
        elevateVibeCreateSeed = await seedElevateVibeCreateProspects();
      } catch (err) {
        elevateVibeCreateSeed = { error: err instanceof Error ? err.message : "Elevate/Vibe/Create seed failed" };
      }
      try {
        ballardFcSeed = await seedBallardFcConversation();
      } catch (err) {
        ballardFcSeed = { error: err instanceof Error ? err.message : "Ballard FC seed failed" };
      }
      try {
        seattleFundraisersSeed = await seedSeattleFundraisers2027();
      } catch (err) {
        seattleFundraisersSeed = { error: err instanceof Error ? err.message : "Seattle fundraisers seed failed" };
      }
      try {
        resendForwardSeed = await seedResendForward();
      } catch (err) {
        resendForwardSeed = { error: err instanceof Error ? err.message : "Resend Forward seed failed" };
      }
    }

    const limit = Number(process.env.SALES_PIPELINE_BATCH_SIZE) || undefined;
    const summary = await runPipelineBatch(limit);

    let awaitingFill = null;
    if (summary.attempted < 4) {
      try {
        awaitingFill = await fillQueueFromAwaitingContact(4);
      } catch (err) {
        awaitingFill = { error: err instanceof Error ? err.message : "Awaiting-contact fill failed" };
      }
    }

    let pricing = null;
    try {
      pricing = await drainAnthemPricing({ limit: 80, budgetMs: 25_000 });
    } catch (err) {
      pricing = { error: err instanceof Error ? err.message : "Anthem pricing drain failed" };
    }

    let autosend = null;
    try {
      autosend = await tickAutoSend(new Date(), { maxToDraft: 8 });
    } catch {
      await refreshAutoSendPlan().catch(() => null);
    }

    let digest = null;
    let continuation = null;
    if (chainDepth === 0) {
      try {
        digest = await ensureDigestTarget("cron");
        continuation = scheduleDigestContinuation({ request, cronSecret, result: digest });
      } catch (err) {
        digest = { status: "failed", error: err instanceof Error ? err.message : "Digest ensure failed" };
      }
    }

    let pipelineChained = false;
    if (chainDepth < 2) {
      const remaining = await listUnprocessedOrganizations(1).catch(() => []);
      if (remaining.length > 0 && summary.attempted > 0) {
        pipelineChained = true;
        const next = new URL("/api/sales/cron/pipeline", cronBaseUrl(request));
        next.searchParams.set("continue", String(chainDepth + 1));
        const runNext = async () => {
          try {
            await fetch(next.toString(), {
              method: "GET",
              headers: { Authorization: `Bearer ${cronSecret}` },
            }).then((r) => r.text());
          } catch (err) {
            console.error("[pipeline-cron] continuation failed:", err);
          }
        };
        try {
          waitUntil(runNext());
        } catch {
          void runNext();
        }
      }
    }

    return NextResponse.json({
      chainDepth,
      pipelineChained,
      key2027Seed:
        key2027Seed && "attempted" in key2027Seed
          ? {
              attempted: key2027Seed.attempted,
              createdOrgs: key2027Seed.createdOrgs,
              enqueued: key2027Seed.enqueued,
            }
          : key2027Seed,
      nationalSeed: nationalSeed && "attempted" in nationalSeed ? { attempted: nationalSeed.attempted, created: nationalSeed.created, updated: nationalSeed.updated } : nationalSeed,
      amplifySeed,
      elevateVibeCreateSeed,
      ballardFcSeed,
      seattleFundraisersSeed,
      resendForwardSeed,
      summary,
      awaitingFill,
      pricing,
      autosend,
      digest,
      continuation,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
