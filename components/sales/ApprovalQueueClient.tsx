"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { QueueItemDetail } from "@/lib/sales/types";

type ActionKey = "approve" | "approve_with_edits" | "reject" | "defer" | "request_more_research" | "mark_duplicate";

const ACTIONS: { key: ActionKey; label: string; shortcut: string; tone: string }[] = [
  { key: "approve", label: "Approve", shortcut: "A", tone: "bg-emerald-600 hover:bg-emerald-500" },
  { key: "approve_with_edits", label: "Approve w/ edits", shortcut: "E", tone: "bg-emerald-800 hover:bg-emerald-700" },
  { key: "reject", label: "Reject", shortcut: "R", tone: "bg-red-700 hover:bg-red-600" },
  { key: "defer", label: "Defer", shortcut: "D", tone: "bg-amber-700 hover:bg-amber-600" },
  { key: "request_more_research", label: "More research", shortcut: "M", tone: "bg-sky-700 hover:bg-sky-600" },
  { key: "mark_duplicate", label: "Mark duplicate", shortcut: "U", tone: "bg-gray-700 hover:bg-gray-600" },
];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400 border-emerald-700" : score >= 45 ? "text-amber-400 border-amber-700" : "text-gray-400 border-gray-700";
  return <span className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${color}`}>{score.toFixed(0)}</span>;
}

export default function ApprovalQueueClient() {
  const [items, setItems] = useState<QueueItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/queue", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load queue");
      setItems(data.items ?? []);
      setError(null);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[selectedIndex] ?? null;

  useEffect(() => {
    setEditing(false);
    setNotes("");
    if (current?.draft) {
      setEditedSubject(current.draft.editedSubject ?? current.draft.aiSubject);
      setEditedBody(current.draft.editedBody ?? current.draft.aiBody);
    }
  }, [current?.queueItem.id]);

  const decide = useCallback(
    async (action: ActionKey) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/sales/queue/${current.queueItem.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            notes: notes || null,
            editedSubject: action === "approve_with_edits" ? editedSubject : undefined,
            editedBody: action === "approve_with_edits" ? editedBody : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Decision failed");
        setItems((prev) => prev.filter((i) => i.queueItem.id !== current.queueItem.id));
        setSelectedIndex((i) => Math.min(i, Math.max(0, items.length - 2)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decision failed");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, notes, editedSubject, editedBody, items.length]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (editing) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else {
        const action = ACTIONS.find((a) => a.shortcut.toLowerCase() === e.key.toLowerCase());
        if (action && action.key !== "approve_with_edits") {
          e.preventDefault();
          decide(action.key);
        } else if (action?.key === "approve_with_edits") {
          e.preventDefault();
          setEditing(true);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, decide, editing]);

  const pendingCount = items.length;

  if (loading) return <p className="text-gray-400">Loading queue…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
        Queue is empty. Run the pipeline against an organization to generate reviewable opportunities.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded-xl border border-gray-800">
        <div className="border-b border-gray-800 px-4 py-3 text-sm text-gray-400">{pendingCount} pending</div>
        <ul className="max-h-[75vh] overflow-y-auto">
          {items.map((item, i) => (
            <li key={item.queueItem.id}>
              <button
                onClick={() => setSelectedIndex(i)}
                className={`flex w-full items-center justify-between gap-2 border-b border-gray-800 px-4 py-3 text-left text-sm ${
                  i === selectedIndex ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-900"
                }`}
              >
                <span className="truncate">
                  <span className="block truncate font-medium">{item.organization.name}</span>
                  <span className="block truncate text-xs text-gray-500">{item.opportunity.title}</span>
                </span>
                {item.score && <ScoreBadge score={item.score.totalScore} />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {current && (
        <div className="rounded-xl border border-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{current.organization.name}</h2>
              <p className="text-sm text-gray-400">
                {current.organizationTypeLabel ?? "Type unknown"} · {current.opportunity.title}
                {current.opportunityTypeLabel ? ` (${current.opportunityTypeLabel})` : ""}
              </p>
              {current.queueItem.duplicateWarning && (
                <p className="mt-1 text-sm font-medium text-amber-400">⚠ Possible duplicate organization</p>
              )}
            </div>
            <div className="text-right">
              {current.score ? (
                <>
                  <ScoreBadge score={current.score.totalScore} />
                  <p className="mt-1 text-xs text-gray-500">confidence: {current.score.confidence}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No score yet</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</h3>
              {current.contact ? (
                <p className="mt-1 text-sm text-gray-200">
                  {current.contact.fullName ?? "Unnamed"} — {current.contact.roleTitle ?? "unknown role"}
                  <br />
                  <span className="text-gray-400">
                    {current.contact.email ?? "no email"} · {current.contact.emailVerificationStatus}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">No contact identified yet.</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">HubSpot status</h3>
              <p className="mt-1 text-sm text-gray-500">Not synced (Phase 2)</p>
            </div>
          </div>

          {current.score && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Score rationale</h3>
              <p className="mt-1 text-sm text-gray-300">{current.score.rationale}</p>
              {current.score.missingInformation.length > 0 && (
                <p className="mt-1 text-sm text-amber-400">Missing: {current.score.missingInformation.join("; ")}</p>
              )}
            </div>
          )}

          {current.findings.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Key sources</h3>
              <ul className="mt-1 space-y-1 text-sm text-gray-300">
                {current.findings.slice(0, 6).map((f) => (
                  <li key={f.id} className="truncate">
                    <span className={f.origin === "human_provided" ? "text-amber-400" : "text-sky-400"}>
                      [{f.origin === "human_provided" ? "unverified" : "researched"}]
                    </span>{" "}
                    {f.claimText}{" "}
                    {f.sourceUrl && (
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-gray-500 underline">
                        source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft email</h3>
            {current.draft ? (
              editing ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  />
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                  />
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-gray-800 bg-gray-900/60 p-3 text-sm text-gray-200">
                  <p className="font-medium">{current.draft.editedSubject ?? current.draft.aiSubject}</p>
                  <p className="mt-2 whitespace-pre-wrap text-gray-300">{current.draft.editedBody ?? current.draft.aiBody}</p>
                  {current.draft.status === "qa_flagged" && current.draft.qaFlags && (
                    <div className="mt-3 rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
                      QA flagged: {current.draft.qaFlags.map((f) => f.detail).join(" · ")}
                    </div>
                  )}
                </div>
              )
            ) : (
              <p className="mt-1 text-sm text-gray-500">No draft yet (no verified contact, or template missing).</p>
            )}
          </div>

          <div className="mt-4">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Decision notes (optional)"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ACTIONS.map((action) => (
              <button
                key={action.key}
                disabled={busy}
                onClick={() => (action.key === "approve_with_edits" && !editing ? setEditing(true) : decide(action.key))}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${action.tone}`}
              >
                {action.label} <span className="ml-1 text-xs opacity-70">({action.shortcut})</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Keyboard: <kbd>j</kbd>/<kbd>k</kbd> to move, <kbd>a</kbd> approve, <kbd>r</kbd> reject, <kbd>d</kbd> defer, <kbd>m</kbd> more
            research, <kbd>u</kbd> duplicate.{" "}
            <Link href={`/admin/sales/organizations/${current.organization.id}`} className="underline">
              View organization
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
