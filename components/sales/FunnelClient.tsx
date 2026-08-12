"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FunnelItemDetail, Organization, RelationshipStage } from "@/lib/sales/types";
import { gmailThreadUrl } from "@/lib/sales/gmail/constants";
import { FOLLOW_UP_PRESETS, type FollowUpPreset } from "@/lib/sales/outreach/extractFollowUp";

/** Visible kanban columns — Lost stays available via "Mark lost" / Move to, but not as a board column. */
const BOARD_STAGES: { key: RelationshipStage; label: string; accent: string }[] = [
  { key: "awareness", label: "Awareness", accent: "border-sky-800" },
  { key: "interest", label: "Interest", accent: "border-amber-800" },
  { key: "purchase", label: "Purchase", accent: "border-emerald-800" },
];

const ALL_STAGES: { key: RelationshipStage; label: string }[] = [
  ...BOARD_STAGES,
  { key: "lost", label: "Lost" },
];

const ADVANCE_ACTION: Partial<Record<RelationshipStage, { to: RelationshipStage; label: string }>> = {
  awareness: { to: "interest", label: "Mark replied →" },
  interest: { to: "purchase", label: "Mark won →" },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatFollowUp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function matchesQuery(item: FunnelItemDetail, q: string): boolean {
  if (!q) return true;
  const hay = [
    item.organization.name,
    item.opportunity.title,
    item.opportunity.eventOrInitiativeName ?? "",
    item.contact?.fullName ?? "",
    item.contact?.email ?? "",
    item.contact?.roleTitle ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function FollowUpControls({
  opportunityId,
  nextFollowUpAt,
  onScheduled,
}: {
  opportunityId: string;
  nextFollowUpAt: string | null;
  onScheduled: (opportunityId: string, nextFollowUpAt: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [customDate, setCustomDate] = useState("");

  async function schedule(body: { preset?: FollowUpPreset; followUpAt?: string; clear?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to schedule follow-up");
      onScheduled(opportunityId, data.opportunity?.nextFollowUpAt ?? null);
      setCustomDate("");
    } catch {
      // Parent reload on next interaction; keep UI quiet for board density.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-gray-800 pt-2">
      <p className="text-xs text-gray-500">
        {nextFollowUpAt ? (
          <>
            Follow up <span className="text-amber-300">{formatFollowUp(nextFollowUpAt)}</span>
          </>
        ) : (
          "No follow-up scheduled"
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {FOLLOW_UP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            onClick={() => schedule({ preset: p.id })}
            className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:border-gray-500 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
        {nextFollowUpAt && (
          <button
            type="button"
            disabled={busy}
            onClick={() => schedule({ clear: true })}
            className="rounded border border-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-1.5 py-0.5 text-[10px] text-gray-300"
        />
        <button
          type="button"
          disabled={busy || !customDate}
          onClick={() => {
            if (!customDate) return;
            // Noon UTC on the chosen day — avoids timezone edge cases flipping the calendar day.
            schedule({ followUpAt: `${customDate}T12:00:00.000Z` });
          }}
          className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:border-gray-500 disabled:opacity-50"
        >
          Set
        </button>
      </div>
    </div>
  );
}

function FunnelCard({
  item,
  onMove,
  onFollowUp,
}: {
  item: FunnelItemDetail;
  onMove: (opportunityId: string, stage: RelationshipStage) => void;
  onFollowUp: (opportunityId: string, nextFollowUpAt: string | null) => void;
}) {
  const anchor = item.opportunity.stageUpdatedAt ?? item.approvedAt;
  const days = daysSince(anchor);
  const advance = ADVANCE_ACTION[item.opportunity.relationshipStage ?? "lost"];
  const followUpAt = item.opportunity.nextFollowUpAt;
  const followUpPending = followUpAt && new Date(followUpAt).getTime() > Date.now();

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
      {item.needsNudge && <p className="mt-1 text-xs font-medium text-amber-400">Follow-up due</p>}
      {followUpPending && !item.needsNudge && (
        <p className="mt-1 text-xs text-amber-300/80">Follow up {formatFollowUp(followUpAt)}</p>
      )}
      {item.opportunity.lastOutboundAt && !item.opportunity.lastInboundAt && item.opportunity.relationshipStage === "awareness" && (
        <p className="mt-1 text-xs text-sky-400">Awaiting reply</p>
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

      <FollowUpControls
        opportunityId={item.opportunity.id}
        nextFollowUpAt={followUpAt}
        onScheduled={onFollowUp}
      />

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
          {ALL_STAGES.filter((s) => s.key !== item.opportunity.relationshipStage).map((s) => (
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
  const [search, setSearch] = useState("");
  const [dbResults, setDbResults] = useState<Organization[]>([]);
  const [dbSearching, setDbSearching] = useState(false);

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

  // Broader org DB search — finds organizations even when they're not in the funnel yet.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setDbResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDbSearching(true);
      try {
        const res = await fetch(`/api/sales/organizations?search=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) setDbResults(data.organizations ?? []);
      } catch {
        if (!cancelled) setDbResults([]);
      } finally {
        if (!cancelled) setDbSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const moveStage = useCallback(async (opportunityId: string, stage: RelationshipStage) => {
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

  const onFollowUp = useCallback((opportunityId: string, nextFollowUpAt: string | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.opportunity.id === opportunityId
          ? {
              ...item,
              opportunity: { ...item.opportunity, nextFollowUpAt },
              needsNudge: nextFollowUpAt != null && new Date(nextFollowUpAt).getTime() <= Date.now(),
            }
          : item
      )
    );
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => items.filter((item) => matchesQuery(item, q)), [items, q]);

  const grouped = useMemo(() => {
    const byStage = new Map<RelationshipStage, FunnelItemDetail[]>(BOARD_STAGES.map((s) => [s.key, []]));
    for (const item of filtered) {
      const stage = item.opportunity.relationshipStage;
      if (stage && byStage.has(stage)) byStage.get(stage)?.push(item);
    }
    return byStage;
  }, [filtered]);

  const lostMatches = useMemo(
    () => filtered.filter((item) => item.opportunity.relationshipStage === "lost"),
    [filtered]
  );

  const funnelOrgIds = useMemo(() => new Set(items.map((i) => i.organization.id)), [items]);
  const dbOutsideFunnel = useMemo(
    () => dbResults.filter((org) => !funnelOrgIds.has(org.id)),
    [dbResults, funnelOrgIds]
  );

  if (loading) return <p className="text-gray-400">Loading funnel…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="block min-w-0 flex-1 text-xs text-gray-400">
          Search funnel &amp; organizations
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Organization, contact, opportunity…"
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600"
          />
        </label>
        <p className="shrink-0 text-xs text-gray-600 sm:pt-5">
          {filtered.length} of {items.length} in funnel
          {dbSearching ? " · searching DB…" : dbOutsideFunnel.length > 0 ? ` · ${dbOutsideFunnel.length} elsewhere in DB` : ""}
        </p>
      </div>

      {dbOutsideFunnel.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">In database (not in funnel)</h2>
          <ul className="mt-2 space-y-1.5">
            {dbOutsideFunnel.slice(0, 12).map((org) => (
              <li key={org.id}>
                <Link
                  href={`/admin/sales/organizations/${org.id}`}
                  className="text-sm text-sky-400 hover:underline"
                >
                  {org.name}
                </Link>
                {org.websiteUrl && <span className="ml-2 text-xs text-gray-600">{org.websiteUrl}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
          Nothing in the funnel yet. Approving an item in the queue moves it here, into Awareness.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BOARD_STAGES.map((stage) => {
              const stageItems = grouped.get(stage.key) ?? [];
              return (
                <div key={stage.key} className={`rounded-xl border ${stage.accent} bg-gray-950/40`}>
                  <div className="border-b border-gray-800 px-3 py-2">
                    <h2 className="text-sm font-semibold text-white">{stage.label}</h2>
                    <p className="text-xs text-gray-500">
                      {stageItems.length} opportunit{stageItems.length === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                    {stageItems.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-gray-600">Empty</p>
                    ) : (
                      stageItems.map((item) => (
                        <FunnelCard key={item.opportunity.id} item={item} onMove={moveStage} onFollowUp={onFollowUp} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {q && lostMatches.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Lost matches ({lostMatches.length})
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {lostMatches.map((item) => (
                  <FunnelCard key={item.opportunity.id} item={item} onMove={moveStage} onFollowUp={onFollowUp} />
                ))}
              </div>
            </div>
          )}

          {q && filtered.length === 0 && dbOutsideFunnel.length === 0 && !dbSearching && (
            <p className="text-sm text-gray-500">No matches in the funnel or organization database.</p>
          )}
        </>
      )}
    </div>
  );
}
