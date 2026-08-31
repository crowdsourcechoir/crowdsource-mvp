"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FollowUpRow } from "@/lib/sales/follow-ups";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";

type GmailStatus = {
  connected?: boolean;
  email?: string | null;
  sendsEnabled?: boolean;
};

type ConfirmKind = "send-one" | "send-batch" | "snooze" | "lost";

function daysLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "sent today";
  if (days === 1) return "1 day since send";
  return `${days} days since send`;
}

export default function FollowUpsClient() {
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [dueWithoutDraft, setDueWithoutDraft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [sendTargetId, setSendTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/follow-ups", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load follow-ups"));
      const body = data as { rows?: FollowUpRow[]; gmail?: GmailStatus; dueWithoutDraft?: number };
      setRows(body.rows ?? []);
      setGmail(body.gmail ?? null);
      setDueWithoutDraft(body.dueWithoutDraft ?? 0);
      setSelected(new Set());
      setError(null);
    } catch (err) {
      setError(publicErrorMessage(err, "Failed to load follow-ups"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rowKey = useCallback((row: FollowUpRow) => row.queueItemId ?? `opp:${row.opportunityId}`, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(rowKey(row))),
    [rows, selected, rowKey]
  );

  function draftFor(row: FollowUpRow): { subject: string; body: string } {
    if (row.queueItemId && edits[row.queueItemId]) return edits[row.queueItemId];
    return { subject: row.subject, body: stripEmailSignature(row.body) };
  }

  function toggleSelected(row: FollowUpRow) {
    const key = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map(rowKey)));
  }

  async function persistDraft(row: FollowUpRow) {
    if (!row.queueItemId || !row.hasDraft) return;
    const draft = draftFor(row);
    const res = await fetch(`/api/sales/queue/${row.queueItemId}/save-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editedSubject: draft.subject,
        editedBody: stripEmailSignature(draft.body),
      }),
    });
    const data = await readApiJson(res);
    if (!res.ok) throw new Error(apiErrorFromBody(data, "Save failed"));
  }

  async function sendOne(row: FollowUpRow) {
    if (!row.queueItemId || !row.hasDraft) throw new Error("Generate a draft before sending.");
    if (!row.contactEmail) throw new Error("This follow-up has no contact email.");
    if (isOutboundEmailBlocked(row.contactEmail)) {
      throw new Error(`Hard block: will not send to ${row.contactEmail}.`);
    }
    await persistDraft(row);
    const draft = draftFor(row);
    const res = await fetch(`/api/sales/queue/${row.queueItemId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        confirmed: true,
        editedSubject: draft.subject,
        editedBody: stripEmailSignature(draft.body),
      }),
    });
    const data = await readApiJson(res);
    if (!res.ok) throw new Error(apiErrorFromBody(data, "Send failed"));
  }

  async function runActions(kind: ConfirmKind) {
    setBusy(true);
    setConfirm(null);
    setError(null);
    setProgress(null);
    try {
      if (kind === "send-one") {
        const row = rows.find((item) => rowKey(item) === sendTargetId);
        if (!row) throw new Error("Select a follow-up to send.");
        await sendOne(row);
        setRows((prev) => prev.filter((item) => rowKey(item) !== rowKey(row)));
        setProgress("Sent 1 follow-up.");
        return;
      }
      if (kind === "send-batch") {
        const ready = selectedRows.filter((row) => row.hasDraft && row.queueItemId);
        if (ready.length === 0) throw new Error("Select follow-ups that already have a draft.");
        for (let i = 0; i < ready.length; i += 1) {
          setProgress(`Sending ${i + 1} of ${ready.length}…`);
          await sendOne(ready[i]);
          const doneKey = rowKey(ready[i]);
          setRows((prev) => prev.filter((item) => rowKey(item) !== doneKey));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(doneKey);
            return next;
          });
        }
        setProgress(`Sent ${ready.length} follow-up${ready.length === 1 ? "" : "s"}.`);
        return;
      }

      const opportunityIds = selectedRows.map((row) => row.opportunityId);
      if (opportunityIds.length === 0) throw new Error("Select at least one follow-up.");
      const res = await fetch("/api/sales/follow-ups/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: kind === "snooze" ? "snooze" : "lost",
          opportunityIds,
          days: 7,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Action failed"));
      const removed = new Set(opportunityIds);
      setRows((prev) => prev.filter((row) => !removed.has(row.opportunityId)));
      setSelected(new Set());
      setProgress(kind === "snooze" ? `Snoozed ${opportunityIds.length} for 7 days.` : `Marked ${opportunityIds.length} lost.`);
    } catch (err) {
      setError(publicErrorMessage(err, "Action failed"));
    } finally {
      setBusy(false);
      setSendTargetId(null);
    }
  }

  async function generateDrafts() {
    setBusy(true);
    setError(null);
    setProgress("Generating nudge drafts…");
    try {
      const res = await fetch("/api/sales/gmail/nudges/run", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not generate drafts"));
      const result = (data as { result?: { considered?: number; created?: number } }).result;
      setProgress(
        `Considered ${result?.considered ?? 0}, created ${result?.created ?? 0} draft${result?.created === 1 ? "" : "s"}.`
      );
      await load();
    } catch (err) {
      setError(publicErrorMessage(err, "Could not generate drafts"));
    } finally {
      setBusy(false);
    }
  }

  if (loading && rows.length === 0) return <p className="text-gray-400">Loading follow-ups…</p>;
  if (error && rows.length === 0) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">
        <p className="text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-100 hover:bg-red-900/40"
        >
          Retry
        </button>
      </div>
    );
  }

  const sendReadyCount = selectedRows.filter((row) => row.hasDraft && row.queueItemId).length;
  const confirmSendRow = sendTargetId ? rows.find((row) => rowKey(row) === sendTargetId) : null;

  return (
    <div>
      {gmail && !gmail.connected ? (
        <div className="mb-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          Gmail is not connected — in-thread follow-ups will not send from the app. Connect on Today, then Resume
          sending. Batch Send needs Gmail.
        </div>
      ) : null}
      {gmail?.connected && gmail.sendsEnabled === false ? (
        <div className="mb-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          Gmail is connected{gmail.email ? ` as ${gmail.email}` : ""} but sending is paused. Resume sending on Today
          before follow-ups go out.
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void generateDrafts()}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          Generate drafts
        </button>
        <button
          type="button"
          disabled={busy || sendReadyCount === 0 || !gmail?.connected}
          onClick={() => setConfirm("send-batch")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Send selected{sendReadyCount > 0 ? ` (${sendReadyCount})` : ""}
        </button>
        <button
          type="button"
          disabled={busy || selectedRows.length === 0}
          onClick={() => setConfirm("snooze")}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          Snooze 7 days
        </button>
        <button
          type="button"
          disabled={busy || selectedRows.length === 0}
          onClick={() => setConfirm("lost")}
          className="rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-50"
        >
          Mark lost
        </button>
        <Link href="/admin/sales/queue" className="ml-auto text-xs text-gray-500 underline">
          First-touch Queue
        </Link>
      </div>

      {dueWithoutDraft > 0 ? (
        <p className="mb-3 text-sm text-amber-300">
          {dueWithoutDraft} due without a draft — Generate drafts, then send. Never auto-sends.
        </p>
      ) : null}
      {progress ? <p className="mb-3 text-sm text-emerald-400">{progress}</p> : null}
      {error ? <p className="mb-3 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
          No follow-ups due. First-touch drafts stay in Queue.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <div className="flex items-center gap-3 border-b border-gray-800 bg-gray-950/60 px-4 py-2 text-xs text-gray-500">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
              {rows.length} follow-up{rows.length === 1 ? "" : "s"}
            </label>
          </div>
          <ul>
            {rows.map((row) => {
              const key = rowKey(row);
              const open = expandedId === key;
              const draft = draftFor(row);
              return (
                <li key={key} className="border-b border-gray-800 last:border-b-0">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(key)}
                      onChange={() => toggleSelected(row)}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : key)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block font-medium text-white">{row.organizationName}</span>
                      <span className="block text-xs text-gray-500">
                        {row.contactName ?? "No contact on draft"}
                        {row.contactEmail ? ` · ${row.contactEmail}` : ""}
                        {" · "}
                        {daysLabel(row.daysSinceSend)}
                        {row.hasDraft ? "" : " · no draft yet"}
                      </span>
                      {row.hasDraft ? (
                        <span className="mt-1 block truncate text-sm text-gray-400">{draft.subject || "(no subject)"}</span>
                      ) : null}
                    </button>
                    {row.hasDraft ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setSendTargetId(key);
                          setConfirm("send-one");
                        }}
                        className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        Send
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-600">Generate drafts</span>
                    )}
                  </div>
                  {open && row.hasDraft && row.queueItemId ? (
                    <div className="space-y-2 border-t border-gray-900 bg-gray-950/40 px-4 py-3 pl-12">
                      <input
                        value={draft.subject}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.queueItemId as string]: { subject: e.target.value, body: draft.body },
                          }))
                        }
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
                      />
                      <textarea
                        value={draft.body}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.queueItemId as string]: { subject: draft.subject, body: e.target.value },
                          }))
                        }
                        rows={8}
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void persistDraft(row).then(
                            () => setProgress("Draft saved."),
                            (err) => setError(publicErrorMessage(err, "Save failed"))
                          );
                        }}
                        className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                      >
                        Save draft
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">
              {confirm === "send-one" || confirm === "send-batch"
                ? "Do you really want to send?"
                : confirm === "snooze"
                  ? "Snooze for 7 days?"
                  : "Mark lost?"}
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              {confirm === "send-one" ? (
                <>
                  This will email{" "}
                  <span className="font-medium text-white">{confirmSendRow?.contactName ?? "the contact"}</span>
                  {confirmSendRow?.contactEmail ? (
                    <>
                      {" "}
                      at <span className="text-sky-300">{confirmSendRow.contactEmail}</span>
                    </>
                  ) : null}{" "}
                  in-thread if Gmail is connected. Never auto-sends.
                </>
              ) : confirm === "send-batch" ? (
                <>
                  Send {sendReadyCount} follow-up{sendReadyCount === 1 ? "" : "s"} one at a time via Gmail. Each uses
                  the same Send confirmation path as Queue. Nothing else goes out.
                </>
              ) : confirm === "snooze" ? (
                <>Bump next follow-up 7 days and pull these out of the list. First-touch Queue is unchanged.</>
              ) : (
                <>Move {selectedRows.length} to Lost and dismiss pending nudge drafts. This does not send email.</>
              )}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirm(null);
                  setSendTargetId(null);
                }}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runActions(confirm)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirm === "lost" ? "bg-red-800 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {confirm === "send-one" || confirm === "send-batch"
                  ? "Yes, send now"
                  : confirm === "snooze"
                    ? "Snooze 7 days"
                    : "Mark lost"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
