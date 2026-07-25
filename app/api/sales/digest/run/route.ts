import { NextResponse } from "next/server";
import { ensureDigestTarget } from "@/lib/sales/digest/ensure";
import { getDigestMinScore } from "@/lib/sales/digest/config";
import { loadAllPendingDigestItems, sendDailyDigest } from "@/lib/sales/digest/send";

export const dynamic = "force-dynamic";
/** May top up pipeline briefly before sending when under the 70+/10 target. */
export const maxDuration = 290;

/**
 * Manual trigger — runs the same ensure+send path as cron so a phone/admin "send now" can
 * recover stranded pending 70+ leads and actually deliver the morning email.
 * Pass `?force=1` to send all current pending min-score leads immediately (bypasses already_sent /
 * target wait) — useful after fixing email link hosts. Skips sending if none qualify.
 */
export async function POST(request: Request) {
  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    if (force) {
      const minScore = getDigestMinScore();
      const loaded = await loadAllPendingDigestItems(minScore);
      if (loaded.items.length === 0) {
        return NextResponse.json({
          result: { status: "skipped_empty", itemCount: 0, minScore },
        });
      }
      const result = await sendDailyDigest("manual", {
        items: loaded.items,
        sinceIso: loaded.sinceIso,
        backlogCount: loaded.backlogCount,
        minScore,
      });
      return NextResponse.json({ result });
    }
    const result = await ensureDigestTarget("manual");
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
