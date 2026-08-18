"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";
import type { FunnelItemDetail, RelationshipStage } from "@/lib/sales/types";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";

const STAGES = FUNNEL_STAGES.map((s) => ({
  ...s,
  accent:
    s.key === "awareness"
      ? "border-sky-800"
      : s.key === "interest"
        ? "border-amber-800"
        : s.key === "purchase"
          ? "border-emerald-800"
          : "border-gray-700",
}));

const ADVANCE_ACTION: Partial<Record<RelationshipStage, { to: RelationshipStage; label: string }>> = {
  awareness: { to: "interest", label: "Mark replied →" },
  interest: { to: "purchase", label: "Mark won →" },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function FunnelCard({ item, onMove }: { item: FunnelItemDetail; onMove: (opportunityId: string, stage: RelationshipStage) => void }) {
  const anchor = item.opportunity.stageUpdatedAt ?? item.approvedAt;
  const days = daysSince(anchor);
  const advance = ADVANCE_ACTION[item.opportunity.relationshipStage ?? "lost"];

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
      <Link href={`/admin/sales/opportunities/${item.opportunity.id}`} className="block hover:underline">
        <p className="truncate text-sm font-semibold text-white">{item.organization.name}</p>
      </Link>
      <p className="truncate text-xs text-gray-400">{item.opportunity.title}</p>
      <p className="mt-1 truncate text-xs text-gray-500">
        {item.contact ? `${item.contact.fullName ?? "Unnamed"} — ${item.contact.roleTitle ?? "unknown role"}` : "No contact on record"}
      </p>
      <p className="mt-1 text-xs text-gray-600">{days === null ? "—" : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`}</p>
      {item.needsNudge && <p className="mt-1 text-xs font-medium text-amber-400">Needs nudge</p>}
      {item.opportunity.lastOutboundAt && !item.opportunity.lastInboundAt && item.opportunity.relationshipStage === "awareness" && (
        <p className="mt-1 text-xs text-sky-400">
          Awaiting reply
          {item.opportunity.nextFollowUpAt
            ? ` · nudge ${new Date(item.opportunity.nextFollowUpAt).toLocaleDateString()}`
            : ""}
        </p>
      )}
      {item.opportunity.gmailThreadId && (
        <a
          href={gmailThreadUrl(item.opportunity.gmailThreadId)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block text-xs text-sky-400 underline"
        >
          Open Gmail thread
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {advance && (
          <button
            onClick={() => onMove(item.opportunity.id, advance.to)}
            className="rounded-md bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
          >
            {advance.label}
          </button>
        )}
        {item.opportunity.relationshipStage !== "lost" && (
          <button
            onClick={() => onMove(item.opportunity.id, "lost")}
            className="rounded-md bg-red-800 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Mark lost
          </button>
        )}
        <select
          value=""
          onChange={(e) => {
            const stage = e.target.value as RelationshipStage;
            if (stage) onMove(item.opportunity.id, stage);
          }}
          className="rounded-md border border-gray-700 bg-gray-900 px-1.5 py-1 text-xs text-gray-400"
        >
          <option value="">Move to…</option>
          {STAGES.filter((s) => s.key !== item.opportunity.relationshipStage).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FunnelClient() {
  const [items, setItems] = useState<FunnelItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/funnel", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load funnel");
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load funnel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moveStage = useCallback(async (opportunityId: string, stage: RelationshipStage) => {
    // Optimistic update — this is a low-stakes, frequently-corrected action, so it's more
    // important that the board feels immediate than that it's perfectly consistent with a
    // concurrent edit from elsewhere.
    setItems((prev) =>
      prev.map((item) =>
        item.opportunity.id === opportunityId
          ? { ...item, opportunity: { ...item.opportunity, relationshipStage: stage, stageUpdatedAt: new Date().toISOString() } }
          : item
      )
    );
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to move stage");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move stage");
      load();
    }
  }, [load]);

  const grouped = useMemo(() => {
    const byStage = new Map<RelationshipStage, FunnelItemDetail[]>(STAGES.map((s) => [s.key, []]));
    for (const item of items) {
      if (item.opportunity.relationshipStage) byStage.get(item.opportunity.relationshipStage)?.push(item);
    }
    return byStage;
  }, [items]);

  if (loading) return <p className="text-gray-400">Loading funnel…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
        Nothing in the funnel yet. Approving an item in the queue moves it here, into Awareness.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAGES.map((stage) => {
        const stageItems = grouped.get(stage.key) ?? [];
        return (
          <div key={stage.key} className={`rounded-xl border ${stage.accent} bg-gray-950/40`}>
            <div className="border-b border-gray-800 px-3 py-2">
              <h2 className="text-sm font-semibold text-white">{stage.label}</h2>
              <p className="text-xs text-gray-500">{stageItems.length} opportunit{stageItems.length === 1 ? "y" : "ies"}</p>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
              {stageItems.length === 0 ? (
                <p className="px-1 py-2 text-xs text-gray-600">Empty</p>
              ) : (
                stageItems.map((item) => <FunnelCard key={item.opportunity.id} item={item} onMove={moveStage} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
