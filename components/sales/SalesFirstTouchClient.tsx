"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FirstTouchEvent, FirstTouchSnapshot } from "@/lib/sales/outreach/first-touch-metrics";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function kindLabel(kind: FirstTouchEvent["kind"]): { text: string; className: string } {
  if (kind === "replied") return { text: "Live reply", className: "text-[#CFFF81]" };
  if (kind === "auto") return { text: "Auto-reply", className: "text-amber-300" };
  if (kind === "bounced") return { text: "Bounced", className: "text-red-400" };
  return { text: "Sent", className: "text-sky-300" };
}

function decodeSnippet(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function inLast7Days(iso: string, nowMs: number): boolean {
  return nowMs - new Date(iso).getTime() <= WEEK_MS;
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-gray-400">{hint}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 hover:border-gray-600">
        {inner}
      </Link>
    );
  }
  return <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">{inner}</div>;
}

function EventRow({ event, showSnippet }: { event: FirstTouchEvent; showSnippet: boolean }) {
  const kind = kindLabel(event.kind);
  return (
    <li className="grid grid-cols-[4.5rem_5.5rem_1fr] items-start gap-2 border-t border-gray-800 py-2 text-sm first:border-t-0 sm:grid-cols-[6rem_7rem_1fr]">
      <span className="text-gray-500">{formatDay(event.occurredAt)}</span>
      <span className={kind.className}>{kind.text}</span>
      <div className="min-w-0">
        <Link href={`/admin/sales/opportunities/${event.opportunityId}`} className="truncate font-medium text-white hover:underline">
          {event.organizationName}
        </Link>
        {event.contactName ? <p className="truncate text-xs text-gray-500">{event.contactName}</p> : null}
        {showSnippet && event.snippet ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{decodeSnippet(event.snippet)}</p>
        ) : null}
      </div>
    </li>
  );
}

function CollapsedList({
  title,
  count,
  empty,
  events,
}: {
  title: string;
  count: number;
  empty: string;
  events: FirstTouchEvent[];
}) {
  return (
    <details className="group rounded-xl border border-gray-800">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>
            {title}
            <span className="ml-2 font-normal text-gray-500">{count}</span>
          </span>
          <span className="text-xs font-normal text-gray-500 group-open:hidden">Show</span>
          <span className="hidden text-xs font-normal text-gray-500 group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="border-t border-gray-800 px-4 pb-3 pt-1">
        {events.length === 0 ? (
          <p className="py-2 text-xs text-gray-500">{empty}</p>
        ) : (
          <ul>
            {events.map((event) => (
              <EventRow key={event.id} event={event} showSnippet />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default function SalesFirstTouchClient() {
  const [snapshot, setSnapshot] = useState<FirstTouchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/metrics", { cache: "no-store" });
    const data = await readApiJson(res);
    if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load outreach metrics"));
    setSnapshot(data as FirstTouchSnapshot);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(publicErrorMessage(err, "Failed to load outreach metrics"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales/gmail/sync", { method: "POST" })
      .then(async (res) => {
        const data = await readApiJson(res);
        if (!res.ok || cancelled) return;
        const result = (data as { result?: { skippedReason?: string; repliesRecorded?: number; autoRepliesRecorded?: number; bouncesRecorded?: number } }).result;
        if (result?.skippedReason) return;
        const added =
          Number(result?.repliesRecorded ?? 0) +
          Number(result?.autoRepliesRecorded ?? 0) +
          Number(result?.bouncesRecorded ?? 0);
        if (added > 0) await load();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function refreshFromGmail() {
    setSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const res = await fetch("/api/sales/gmail/sync", { method: "POST" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Gmail sync failed"));
      const result = (data as { result?: Record<string, unknown> }).result;
      if (result?.skippedReason) {
        setSyncNote(String(result.skippedReason));
      } else {
        const live = Number(result?.repliesRecorded ?? 0);
        const auto = Number(result?.autoRepliesRecorded ?? 0);
        const bounced = Number(result?.bouncesRecorded ?? 0);
        setSyncNote(
          `Gmail scan: ${live} live ${live === 1 ? "reply" : "replies"}, ${auto} auto-replies, ${bounced} ${bounced === 1 ? "bounce" : "bounces"}.`
        );
      }
      await load();
    } catch (err) {
      setError(publicErrorMessage(err, "Gmail sync failed"));
    } finally {
      setSyncing(false);
    }
  }

  const weekEvents = useMemo(() => {
    if (!snapshot) return [];
    const week = snapshot.events.filter((event) => inLast7Days(event.occurredAt, nowMs));
    if (week.length >= 3) return week.slice(0, 10);
    return snapshot.events.slice(0, 8);
  }, [snapshot, nowMs]);

  const weekLabel = useMemo(() => {
    if (!snapshot) return "Recent activity";
    const week = snapshot.events.filter((event) => inLast7Days(event.occurredAt, nowMs));
    return week.length >= 3 ? "This week" : "Recent activity";
  }, [snapshot, nowMs]);

  const firstTouches = snapshot?.firstTouches ?? 0;

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-950/30 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Outreach</p>
          <h2 className="mt-1 text-lg font-semibold text-white">This week and first-touch rates</h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Success is a real person writing back after the first email. Refresh pulls Gmail; nothing is sent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshFromGmail()}
          disabled={syncing}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          {syncing ? "Scanning Gmail…" : "Refresh from Gmail"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {syncNote ? <p className="mb-3 text-sm text-[#CFFF81]/90">{syncNote}</p> : null}

      {loading && !snapshot ? (
        <p className="text-sm text-gray-500">Loading outreach numbers…</p>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Sent this week"
              value={String(snapshot.emailsSent7d)}
              hint={`${snapshot.emailsSent} total · ${snapshot.firstTouches7d} first touches`}
            />
            <StatCard
              label="Live replies"
              value={pct(snapshot.liveReplyRate)}
              hint={`${snapshot.liveReplies} of ${firstTouches} first touches · ${snapshot.liveReplies7d} this week`}
              href="/admin/sales/funnel"
            />
            <StatCard
              label="Bounced"
              value={pct(snapshot.bounceRate)}
              hint={
                snapshot.bounces === 0
                  ? "No delivery failures yet"
                  : `${snapshot.bounces} first-touch ${snapshot.bounces === 1 ? "bounce" : "bounces"}`
              }
            />
            <StatCard
              label="Awaiting reply"
              value={String(snapshot.awaiting)}
              hint={
                snapshot.autoReplies > 0
                  ? `${snapshot.autoReplies} out-of-office, not counted as success`
                  : "No live reply and no bounce yet"
              }
              href="/admin/sales/funnel"
            />
          </div>

          <div className="mt-4 rounded-xl border border-gray-800 p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">{weekLabel}</h3>
            {weekEvents.length === 0 ? (
              <p className="text-xs text-gray-500">Send from the queue and this timeline will fill in.</p>
            ) : (
              <ul>
                {weekEvents.map((event) => (
                  <EventRow key={`${event.kind}-${event.id}`} event={event} showSnippet={false} />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <CollapsedList
              title="Live replies"
              count={snapshot.liveReplies}
              empty="None recorded yet. If you already have threads in Gmail, click Refresh from Gmail."
              events={snapshot.recentLiveReplies}
            />
            <CollapsedList
              title="Bounces"
              count={snapshot.bounces}
              empty="No Gmail bounce notices matched to a sent first touch."
              events={snapshot.recentBounces}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
