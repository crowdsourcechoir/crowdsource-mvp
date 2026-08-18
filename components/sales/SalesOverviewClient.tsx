"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SalesOverviewClient() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [funnelCount, setFunnelCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/sales/queue", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPendingCount(Array.isArray(d.items) ? d.items.length : 0))
      .catch(() => setPendingCount(null));
    fetch("/api/sales/organizations", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOrgCount(Array.isArray(d.organizations) ? d.organizations.length : 0))
      .catch(() => setOrgCount(null));
    fetch("/api/sales/funnel", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFunnelCount(Array.isArray(d.items) ? d.items.length : 0))
      .catch(() => setFunnelCount(null));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Link href="/admin/sales/queue" className="rounded-xl border border-gray-800 p-6 hover:border-gray-600">
        <p className="text-sm text-gray-500">Pending review</p>
        <p className="mt-1 text-3xl font-bold text-white">{pendingCount ?? "—"}</p>
        <p className="mt-2 text-sm text-gray-400">Go to approval queue →</p>
      </Link>
      <Link href="/admin/sales/organizations" className="rounded-xl border border-gray-800 p-6 hover:border-gray-600">
        <p className="text-sm text-gray-500">Organizations</p>
        <p className="mt-1 text-3xl font-bold text-white">{orgCount ?? "—"}</p>
        <p className="mt-2 text-sm text-gray-400">Manage organizations & run pipeline →</p>
      </Link>
      <Link href="/admin/sales/funnel" className="rounded-xl border border-gray-800 p-6 hover:border-gray-600">
        <p className="text-sm text-gray-500">In the funnel</p>
        <p className="mt-1 text-3xl font-bold text-white">{funnelCount ?? "—"}</p>
        <p className="mt-2 text-sm text-gray-400">Track Awareness → Interest → Won →</p>
      </Link>
    </div>
  );
}
