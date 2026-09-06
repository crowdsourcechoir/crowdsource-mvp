"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SalesDashboardBuckets } from "@/lib/sales/db/dashboard";
import type { SalesTodayTask } from "@/lib/sales/db/follow-ups";
import { publicErrorMessage } from "@/lib/sales/http-error";
import GmailThreadLink from "@/components/sales/GmailThreadLink";

function funnelHint(buckets: SalesDashboardBuckets | null): string {
  if (!buckets) return "Awareness → Interest → Won";
  const { funnelByStage } = buckets;
  const parts = [
    funnelByStage.awareness ? `${funnelByStage.awareness} awareness` : null,
    funnelByStage.interest ? `${funnelByStage.interest} interest` : null,
    funnelByStage.lost ? `${funnelByStage.lost} lost` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Awareness → Interest → Won";
}

function queueHref(task: SalesTodayTask): string {
  if (task.queueItemId) return `/admin/sales/queue?scope=due&item=${encodeURIComponent(task.queueItemId)}`;
  return `/admin/sales/opportunities/${task.opportunityId}`;
}

const PREVIEW = 4;

export default function SalesOverviewClient() {
  const [buckets, setBuckets] = useState<SalesDashboardBuckets | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales/overview", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load");
        setBuckets(data as SalesDashboardBuckets);
        setError(null);
      })
      .catch((err) => {
        setError(publicErrorMessage(err, "Failed to load dashboard"));
        setBuckets(null);
      });
  }, []);

  const wins = buckets?.wins ?? [];
  const today = buckets?.today;
  const tasks = today?.tasks.slice(0, PREVIEW) ?? [];
  const extra = Math.max(0, (today?.dueCount ?? 0) - tasks.length);

  return (
    <div className="mb-6">
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      <section className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/90">Today</p>
            {buckets && today ? (
              today.dueCount === 0 ? (
                <p className="mt-1 text-sm text-gray-400">No live replies waiting.</p>
              ) : (
                <p className="mt-1 text-sm text-gray-300">
                  <span className="font-semibold text-white">{today.dueCount}</span> wrote back
                  {today.overdueCount ? ` · ${today.overdueCount} overdue` : ""}
                  <span className="text-gray-500"> — open the Gmail thread to reply</span>
                </p>
              )
            ) : (
              <p className="mt-1 text-sm text-gray-500">Loading…</p>
            )}
          </div>
          <Link href="/admin/sales/queue?scope=due" className="shrink-0 text-sm text-amber-200/90 hover:underline">
            Follow-ups in queue →
          </Link>
        </div>
        {tasks.length > 0 ? (
          <ul className="mt-2 divide-y divide-gray-800/80">
            {tasks.map((task) => (
              <li key={task.opportunityId} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={queueHref(task)} className="min-w-0 truncate text-sm text-white hover:underline">
                  {task.organizationName}
                  {task.contactName ? (
                    <span className="text-gray-500"> · {task.contactName}</span>
                  ) : null}
                </Link>
                {task.gmailThreadId ? (
                  <GmailThreadLink
                    threadId={task.gmailThreadId}
                    className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
                  >
                    Open Gmail
                  </GmailThreadLink>
                ) : (
                  <Link
                    href={queueHref(task)}
                    className="shrink-0 text-xs text-gray-500 hover:underline"
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {extra > 0 ? (
          <p className="mt-2 text-xs text-gray-500">
            <Link href="/admin/sales/queue?scope=due" className="text-amber-200/80 hover:underline">
              +{extra} more in queue
            </Link>
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/sales/queue" className="rounded-xl border border-gray-800 p-5 hover:border-gray-600">
          <p className="text-sm text-gray-500">Queue</p>
          <p className="mt-1 text-3xl font-bold text-white">{buckets ? buckets.pendingCount : "—"}</p>
          <p className="mt-2 text-sm text-gray-400">To send →</p>
        </Link>
        <Link href="/admin/sales/organizations" className="rounded-xl border border-gray-800 p-5 hover:border-gray-600">
          <p className="text-sm text-gray-500">Organizations</p>
          <p className="mt-1 text-3xl font-bold text-white">{buckets ? buckets.orgCount : "—"}</p>
          <p className="mt-2 text-sm text-gray-400">Manage orgs →</p>
        </Link>
        <Link href="/admin/sales/funnel" className="rounded-xl border border-gray-800 p-5 hover:border-gray-600">
          <p className="text-sm text-gray-500">In the funnel</p>
          <p className="mt-1 text-3xl font-bold text-white">{buckets ? buckets.funnelCount : "—"}</p>
          <p className="mt-2 text-sm text-gray-400">{funnelHint(buckets)}</p>
        </Link>
        <Link href="/admin/sales/funnel" className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-5 hover:border-emerald-700">
          <p className="text-sm text-emerald-200/80">Wins</p>
          <p className="mt-1 text-3xl font-bold text-white">{buckets ? wins.length : "—"}</p>
          <p className="mt-2 text-sm text-gray-400">Marked won in the funnel →</p>
        </Link>
      </div>
      {wins.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {wins.slice(0, 8).map((win) => (
            <li key={win.id}>
              <Link
                href={`/admin/sales/opportunities/${win.id}`}
                className="inline-flex rounded-full border border-emerald-800/70 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-200 hover:border-emerald-600"
              >
                {win.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
