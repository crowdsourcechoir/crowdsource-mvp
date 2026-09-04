"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SalesDashboardBuckets } from "@/lib/sales/db/dashboard";
import { publicErrorMessage } from "@/lib/sales/http-error";

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

  return (
    <div className="mb-6">
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/sales/queue" className="rounded-xl border border-gray-800 p-5 hover:border-gray-600">
          <p className="text-sm text-gray-500">Pending review</p>
          <p className="mt-1 text-3xl font-bold text-white">{buckets ? buckets.pendingCount : "—"}</p>
          <p className="mt-2 text-sm text-gray-400">Approval queue →</p>
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
