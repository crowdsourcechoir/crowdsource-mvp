import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { readAutoSendState } from "@/lib/sales/autosend/store";
import { refreshAutoSendPlan, tickAutoSend } from "@/lib/sales/autosend/tick";
import { buildAutoSendQueueView } from "@/lib/sales/autosend/view";
import {
  getKey2027ProspectsSeedStatus,
  seedKey2027Prospects,
} from "@/lib/sales/seed/seed-key-2027-prospects";
import { ensureBookLinks } from "@/lib/sales/outreach/ensureBookLinks";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

let linksEnsuredInCronInstance = false;

/**
 * GET ?status=1 — read-only lineup summary (counts, days covered, org names/lanes/fees — no email addresses or bodies).
 * GET with Bearer CRON_SECRET — refreshes the 30-day $15k+ lineup and pre-loads due Gmail drafts.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    try {
      if (!linksEnsuredInCronInstance) {
        linksEnsuredInCronInstance = true;
        try {
          waitUntil(ensureBookLinks().catch(() => null));
        } catch {
          void ensureBookLinks().catch(() => null);
        }
      }
      const seedStatus = await getKey2027ProspectsSeedStatus().catch(() => ({ done: true }));
      if (!seedStatus.done) {
        await seedKey2027Prospects().catch(() => null);
      }
      const current = await readAutoSendState();
      const age = current.state.updatedAt ? Date.now() - Date.parse(current.state.updatedAt) : Number.POSITIVE_INFINITY;
      const loaded = !seedStatus.done || current.error || age > 60_000 ? await refreshAutoSendPlan() : current;
      const view = await buildAutoSendQueueView(loaded.state, loaded.error);
      return NextResponse.json({
        enabled: view.enabled,
        gmailConnected: view.gmailConnected,
        gmailComposeGranted: view.gmailComposeGranted,
        today: view.today,
        horizonDays: view.horizonDays,
        daysCovered: view.daysCovered,
        totalDrafted: view.totalDrafted,
        totalLinedUp: view.totalLinedUp,
        ready: view.ready,
        mix: view.mix,
        sampleLineup: view.groups
          .flatMap((g) => g.slots)
          .filter((s) => s.status === "queued" || s.status === "drafted")
          .slice(0, 20)
          .map((s) => ({
            day: s.day,
            lane: s.lane,
            score: Math.round(s.score),
            suggestedFee: s.suggestedFee ?? null,
            organizationName: s.organizationName,
            eventTitle: s.eventTitle,
            eventDate: s.eventDate,
            status: s.status,
            hasBody: Boolean(s.body?.trim()),
          })),
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
    }
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tick = await tickAutoSend();
    return NextResponse.json(tick);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
