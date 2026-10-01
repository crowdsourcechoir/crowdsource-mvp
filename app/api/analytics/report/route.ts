import { NextResponse } from "next/server";
import { aggregateVisits, rangeStart, type SegmentId, SEGMENTS } from "@/lib/analytics/model";
import { readVisitsBetween } from "@/lib/analytics/store";
import { signedInOwner } from "@/lib/operators/current";

export const dynamic = "force-dynamic";

function daysFrom(value: string | null): number {
  const parsed = Number(value);
  if (parsed === 7 || parsed === 90) return parsed;
  return 30;
}

function segmentFrom(value: string | null): SegmentId | null {
  if (!value) return null;
  return SEGMENTS.some((item) => item.id === value) ? (value as SegmentId) : null;
}

export async function GET(request: Request) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = new URL(request.url);
  const days = daysFrom(url.searchParams.get("days"));
  const includeInternal = url.searchParams.get("internal") === "1";
  const segment = segmentFrom(url.searchParams.get("segment"));
  const now = Date.now();
  const stored = await readVisitsBetween(rangeStart(days, now), now);
  const report = aggregateVisits(stored.events, { days, includeInternal, segment, now });
  return NextResponse.json(
    { ...report, storageError: stored.error },
    { headers: { "Cache-Control": "no-store" } }
  );
}
