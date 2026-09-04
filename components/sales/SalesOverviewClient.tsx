"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SalesDashboardBuckets } from "@/lib/sales/db/dashboard";
import type { SalesTodayTask } from "@/lib/sales/db/follow-ups";
import { formatFollowUpDay } from "@/lib/sales/follow-up/calendar";
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

function taskHref(task: SalesTodayTask): string {
  return `/admin/sales/opportunities/${task.opportunityId}`;
}

function reasonLabel(reason: SalesTodayTask["reason"]): { text: string; className: string } {
  if (reason === "overdue") return { text: "Overdue", className: "text-red-400" };
  if (reason === "replied") return { text: "Wrote back", className: "text-[#CFFF81]" };
  return { text: "Follow up", className: "text-amber-300" };
}

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
  const tasks = today?.tasks.slice(0, 12) ?? [];

  return (
    <div className="mb-6">
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      <section className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/90">Today</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Follow-ups after they wrote back</h2>
            <p className="mt-1 text-xs text-gray-500">
              Only people who replied. Cold emails with no reply stay out of this list.
            </p>
          </div>
          <Link href="/admin/sales/queue?scope=due" className="text-sm text-amber-200/90 hover:underline">
            Open follow-ups in queue →
          </Link>
        </div>
        {buckets && today ? (
          today.dueCount === 0 ? (
            <p className="mt-4 text-sm text-gray-400">Nobody who wrote back is due today.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-gray-400">
                <span className="font-semibold text-white">{today.dueCount}</span> to follow up
                {today.overdueCount ? ` · ${today.overdueCount} overdue` : ""}
              </p>
              <ul className="mt-3 divide-y divide-gray-800">
                {tasks.map((task) => {
                  const reason = reasonLabel(task.reason);
                  return (
                    <li key={task.opportunityId} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link href={taskHref(task)} className="truncate font-medium text-white hover:underline">
                          {task.organizationName}
                        </Link>
                        <p className="truncate text-xs text-gray-500">
                          <span className={reason.className}>{reason.text}</span>
                          {task.contactName ? ` · ${task.contactName}` : ""}
                          {task.nextFollowUpAt ? ` · ${formatFollowUpDay(task.nextFollowUpAt)}` : " · set a date"}
                          {task.snippet ? ` · ${task.snippet}` : ""}
                        </p>
                      </div>
                      {task.gmailThreadId ? (
                        <GmailThreadLink
                          threadId={task.gmailThreadId}
                          className="shrink-0 text-xs text-sky-400 hover:underline"
                        >
                          Thread
                        </GmailThreadLink>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )
        ) : (
          <p className="mt-4 text-sm text-gray-500">Loading today’s tasks…</p>
        )}
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
