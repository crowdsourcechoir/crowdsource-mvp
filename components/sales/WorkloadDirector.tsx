"use client";

import Link from "next/link";
import type { WorkstreamLaneStats } from "@/lib/sales/db/dashboard";
import { formatUsd } from "@/lib/sales/engines";
import { PLAYBOOK } from "@/lib/sales/strategy/playbook";

type Props = {
  workstreams: WorkstreamLaneStats[] | null;
  bookingRule?: string | null;
  operatingRule?: string | null;
};

export default function WorkloadDirector({ workstreams, bookingRule, operatingRule }: Props) {
  const lanes = workstreams ?? [];

  return (
    <section className="mb-4 rounded-xl border border-[var(--csc-accent)]/30 bg-black px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="csc-eyebrow">90-day workload</p>
          <p className="mt-1 text-sm text-gray-300">
            {PLAYBOOK.framing}. Direct time by playbook mix — not by whatever is loudest in the queue.
          </p>
        </div>
        <Link
          href="/admin/sales/queue?workstream=premium&cash=now&scope=all"
          className="csc-link shrink-0 text-sm hover:underline"
        >
          Start Premium cash-now →
        </Link>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className="h-full border-r border-black/40 last:border-r-0 bg-[var(--csc-accent)]"
            style={{ width: `${lane.effortPct}%`, opacity: 0.35 + (lane.effortPct / 100) * 0.65 }}
            title={`${lane.shortLabel} ${lane.effortPct}%`}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        Effort mix {lanes.map((l) => `${l.effortPct}% ${l.shortLabel}`).join(" · ")}
      </p>

      <ul className="mt-3 csc-list">
        {lanes.map((lane) => (
          <li key={lane.key}>
            <Link
              href={lane.queueHref}
              className="csc-list-row flex items-start justify-between gap-3 no-underline hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  <span className="text-[var(--csc-accent)]">{lane.effortPct}%</span> {lane.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{lane.action}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-gray-400">
                <p>
                  <span className="tabular-nums text-white">{lane.cashNowCount}</span> cash-now
                  {" · "}
                  <span className="tabular-nums text-white">{lane.qualifiedCount}</span> qualified
                </p>
                <p className="mt-0.5">
                  <span className="tabular-nums">{lane.interestCount}</span> interest
                  {" · "}
                  {formatUsd(lane.potentialUsd)} potential
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-gray-500">
        <span className="text-gray-400">Booking rule:</span> {bookingRule ?? PLAYBOOK.bookingRule}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        <span className="text-gray-400">Operating rule:</span> {operatingRule ?? PLAYBOOK.operatingRule}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        <span className="text-gray-400">Friday scorecard:</span> {PLAYBOOK.weeklyScorecard}
      </p>
    </section>
  );
}
