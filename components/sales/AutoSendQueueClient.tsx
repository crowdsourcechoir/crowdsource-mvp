"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SettingsButton, SettingsPanel, StatusPill } from "@/components/settings/ui";
import { formatPacificWhen, LANE_LABEL } from "@/lib/sales/autosend/policy";
import { formatUsd } from "@/lib/sales/engines";
import { draftToEmailHtml, draftToPlainText } from "@/lib/sales/outreach/email-body-format";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { ensureEmailSignature, stripEmailSignature } from "@/lib/sales/outreach/signature";
import type { AutoSendQueueView } from "@/lib/sales/autosend/view";
import type { AutoSendSlot } from "@/lib/sales/autosend/types";

function statusLabel(slot: AutoSendSlot): string {
  if (slot.status === "drafted") return "In Gmail Drafts";
  if (slot.status === "sent") return "Sent earlier";
  if (slot.status === "sending") return "Filing draft";
  if (slot.status === "failed") return "Failed";
  if (slot.status === "skipped") return "Skipped";
  return "Ready to draft";
}

function statusTone(slot: AutoSendSlot): "ok" | "warn" | "off" | "neutral" {
  if (slot.status === "sent" || slot.status === "drafted") return "ok";
  if (slot.status === "failed" || slot.status === "skipped") return "warn";
  if (slot.status === "sending") return "ok";
  return "neutral";
}

function gmailComposeNewUrl(to: string, subject: string, body: string, authuser?: string | null): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  params.set("to", to);
  params.set("su", subject);
  params.set("body", body);
  if (authuser?.trim()) params.set("authuser", authuser.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function AutoSendQueueClient() {
  const [view, setView] = useState<AutoSendQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/autosend", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load the draft lineup");
      setView(data as AutoSendQueueView);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the draft lineup");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 25_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function runAction(
    actionKey: string,
    payload: Record<string, unknown>,
    successMessage?: (data: Record<string, unknown>) => string
  ) {
    setBusyAction(actionKey);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sales/autosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Action failed");
      setView(data as unknown as AutoSendQueueView);
      if (successMessage) setNotice(successMessage(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function dismissSlot(slot: AutoSendSlot) {
    setDismissingId(slot.queueItemId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sales/autosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", queueItemId: slot.queueItemId, day: slot.day }),
      });
      const data = (await res.json().catch(() => ({}))) as AutoSendQueueView & {
        error?: string;
        deletedGmailDraft?: boolean;
      };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not remove lead");
      setView(data);
      setNotice(
        `Removed ${slot.organizationName}${data.deletedGmailDraft ? " (and deleted its Gmail draft)" : ""} — replaced automatically with the next qualifying $15k+ lead.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove lead");
    } finally {
      setDismissingId(null);
    }
  }

  function startEditing(slot: AutoSendSlot) {
    setEditingId(slot.queueItemId);
    setEditSubject(slot.subject || "");
    setEditBody(stripEmailSignature(draftToPlainText(slot.body ?? "")));
  }

  async function saveEdit(slot: AutoSendSlot) {
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/autosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          queueItemId: slot.queueItemId,
          editedSubject: editSubject,
          editedBody: editBody,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as AutoSendQueueView & { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save draft");
      setView(data);
      setEditingId(null);
      setNotice(`Saved updated draft for ${slot.organizationName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setSavingEdit(false);
    }
  }

  function handleCopy(slot: AutoSendSlot) {
    const clean = stripEmailSignature(slot.body ?? "");
    const plain = ensureEmailSignature(draftToPlainText(clean));
    const html = draftToEmailHtml(plain);
    copyEmailToClipboard(slot.contactEmail, slot.subject, plain, html)
      .then(() => {
        setCopiedId(slot.queueItemId);
        window.setTimeout(() => setCopiedId((cur) => (cur === slot.queueItemId ? null : cur)), 3000);
      })
      .catch(() => setError("Clipboard copy failed."));
  }

  function handleMailto(slot: AutoSendSlot) {
    const plain = ensureEmailSignature(draftToPlainText(stripEmailSignature(slot.body ?? "")));
    launchMailto(buildMailtoUrl(slot.contactEmail, slot.subject, plain));
  }

  function exportAllCsv() {
    if (!view) return;
    const allSlots: AutoSendSlot[] = [];
    const seen = new Set<string>();
    for (const group of view.groups) {
      for (const slot of group.slots) {
        if (slot.status === "sent") continue;
        if (seen.has(slot.queueItemId)) continue;
        seen.add(slot.queueItemId);
        allSlots.push(slot);
      }
    }
    const header = [
      "Day",
      "Lane",
      "Suggested Fee",
      "Score",
      "Organization",
      "Event",
      "Event Date",
      "Contact Name",
      "Contact Email",
      "Subject",
      "Email Body",
    ];
    const rows = allSlots.map((slot) => {
      const plain = ensureEmailSignature(draftToPlainText(stripEmailSignature(slot.body ?? "")));
      return [
        slot.day,
        LANE_LABEL[slot.lane],
        slot.suggestedFee ?? 15000,
        Math.round(slot.score),
        slot.organizationName,
        slot.eventTitle,
        slot.eventDate,
        slot.contactName ?? "",
        slot.contactEmail,
        slot.subject,
        plain,
      ]
        .map(csvCell)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crowdsource-choir-15k-drafts-${view.today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Prospecting Intelligence · 30+ Day Rolling Draft Pipeline</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">$15k+ Outreach Drafts</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Every qualifying lead is lined up 30 business days ahead with its full draft visible right here — no school auctions or sub-$15k fillers. Click <span className="text-white">Don’t send</span> on any email (or delete it) and the next qualifying $15k+ lead immediately takes its seat. Nothing auto-sends.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SettingsButton
            variant="primary"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("load_more", { action: "load_more", batchLimit: 4 }, (data) => {
                const s = (data.loadedSummary ?? {}) as {
                  pipelineAttempted?: number;
                  pipelineSucceeded?: number;
                  awaitingQueued?: number;
                  draftedToGmail?: number;
                };
                return `Researched ${s.pipelineAttempted ?? 0} new high-value org(s), advanced ${(s.pipelineSucceeded ?? 0) + (s.awaitingQueued ?? 0)}, and filed ${s.draftedToGmail ?? 0} Gmail draft(s).`;
              })
            }
          >
            {busyAction === "load_more" ? "Researching & loading leads…" : "Find & load more $15k+ leads now"}
          </SettingsButton>
          <SettingsButton
            disabled={busyAction !== null || !view?.gmailComposeGranted}
            onClick={() =>
              void runAction("draft_now", { action: "draft_now", maxToDraft: 20 }, (data) => {
                const t = (data.tick ?? {}) as { drafted?: number };
                return `Filed ${t.drafted ?? 0} draft(s) into Gmail Drafts (${view?.gmailEmail ?? "connected inbox"}).`;
              })
            }
          >
            {busyAction === "draft_now" ? "Filing to Gmail…" : "Push next 20 into Gmail Drafts"}
          </SettingsButton>
          <SettingsButton disabled={!view} onClick={exportAllCsv}>
            Export CSV (any mailbox)
          </SettingsButton>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-[var(--csc-accent)]">{notice}</p> : null}
      {view?.storeError ? <p className="mt-4 text-sm text-amber-200">{view.storeError}</p> : null}

      <div className="mt-6">
        <SettingsPanel
          eyebrow="Sender mailbox"
          title={
            view?.gmailConnected && view.gmailEmail
              ? `Connected inbox: ${view.gmailEmail}`
              : "Choose which email address receives these drafts"
          }
          description="Keep filing drafts into your current Gmail account, or click Switch / Connect another Gmail to route the entire 30-day draft pipeline into a brand-new outreach address before you send a single message."
          actions={
            <>
              <StatusPill tone={view?.enabled ? "ok" : "off"}>
                {view?.enabled ? "Pipeline active (24/7)" : "Paused"}
              </StatusPill>
              <StatusPill tone={view?.gmailComposeGranted ? "ok" : "warn"}>
                {view?.gmailComposeGranted ? "Gmail Drafts connected" : "Needs Gmail compose"}
              </StatusPill>
              <SettingsButton href="/api/sales/gmail/connect" variant={view?.gmailComposeGranted ? "ghost" : "primary"}>
                {view?.gmailConnected ? "Switch Gmail / Grant compose" : "Connect Gmail"}
              </SettingsButton>
              <Link href="/admin/settings/autosend" className="csc-link text-xs">
                Settings →
              </Link>
            </>
          }
        >
          {view ? (
            <div className="space-y-1.5 text-sm text-gray-300">
              <p>
                <span className="font-semibold text-white">{view.totalDrafted}</span> in Gmail Drafts ·{" "}
                <span className="font-semibold text-white">{view.totalLinedUp}</span> lined up across{" "}
                <span className="font-semibold text-white">{view.daysCovered}</span> business days (target window: {view.horizonDays} business days · up to {view.dailyCap}/day)
              </p>
              <p className="text-gray-400">
                Daily target mix ($15k+ only):{" "}
                {view.mix.map((lane) => `${lane.label} ${lane.sent + lane.lined}/${lane.quota}`).join(" · ")}
                {view.ready
                  ? ` · Pool ready right now: Large ${view.ready.large} · Sponsorship ${view.ready.sponsorship} · Partnership ${view.ready.partnership}`
                  : ""}
              </p>
              {!view.gmailComposeGranted ? (
                <p className="text-amber-200">
                  Every draft email is already visible below so you can read, edit, copy, or remove leads right now. Click{" "}
                  <a href="/api/sales/gmail/connect" className="csc-link underline">
                    Switch Gmail / Grant compose
                  </a>{" "}
                  once to also drop them directly into Gmail’s Drafts folder.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading the 30-day $15k+ draft lineup…</p>
          )}
        </SettingsPanel>
      </div>

      <div className="mt-8 space-y-8">
        {(view?.groups ?? []).map((group) => (
          <section key={group.key}>
            <div className="flex items-center justify-between gap-2">
              <p className="csc-eyebrow">
                {group.label} ({group.slots.length})
              </p>
            </div>
            {group.slots.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                {group.key === "drafts"
                  ? view?.gmailComposeGranted
                    ? "Click “Push next 20 into Gmail Drafts” or wait for the next 20-minute background tick."
                    : "Grant Gmail compose above to push these drafts straight into your Gmail Drafts folder — all draft copy is shown in the lineup below."
                  : "No leads in this section right now — click “Find & load more $15k+ leads now” above to keep filling."}
              </p>
            ) : (
              <ul className="csc-list mt-3">
                {group.slots.map((slot) => {
                  const plainBody = ensureEmailSignature(draftToPlainText(stripEmailSignature(slot.body ?? "")));
                  const isEditing = editingId === slot.queueItemId;
                  const isDismissing = dismissingId === slot.queueItemId;
                  const composeInConnected = gmailComposeNewUrl(
                    slot.contactEmail,
                    slot.subject,
                    plainBody,
                    view?.gmailEmail
                  );
                  const composeInAnyGmail = gmailComposeNewUrl(slot.contactEmail, slot.subject, plainBody, null);

                  return (
                    <li key={`${slot.day}-${slot.queueItemId}`} className="csc-list-row">
                      <div className="w-full space-y-3 py-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-400">
                              {formatPacificWhen(slot.sentAt ?? slot.scheduledAt)} Pacific · {LANE_LABEL[slot.lane]}
                              {slot.suggestedFee ? ` · est. ${formatUsd(slot.suggestedFee)}` : " · $15k+ tier"} · score{" "}
                              {Math.round(slot.score)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <Link
                                href={`/admin/sales/opportunities/${slot.opportunityId}`}
                                className="text-base font-semibold text-white hover:underline"
                              >
                                {slot.organizationName}
                              </Link>
                              {slot.eventTitle ? (
                                <span className="text-xs text-gray-400">
                                  · {slot.eventTitle}
                                  {slot.eventDate ? ` (${slot.eventDate})` : ""}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-gray-300">
                              To: <span className="text-white">{slot.contactName ? `${slot.contactName} ` : ""}</span>
                              &lt;{slot.contactEmail}&gt;
                            </p>
                            {slot.error ? <p className="mt-1 text-xs text-amber-200">{slot.error}</p> : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <StatusPill tone={statusTone(slot)}>{statusLabel(slot)}</StatusPill>
                            {slot.draftUrl ? (
                              <SettingsButton href={slot.draftUrl} target="_blank" variant="primary">
                                Open Gmail draft
                              </SettingsButton>
                            ) : (
                              <SettingsButton href={composeInConnected} target="_blank" variant="primary">
                                Compose in Gmail
                              </SettingsButton>
                            )}
                            <SettingsButton href={composeInAnyGmail} target="_blank" title="Open in another Gmail account">
                              Other Gmail
                            </SettingsButton>
                            <SettingsButton onClick={() => handleMailto(slot)} title="Open in default mail app">
                              Mail app
                            </SettingsButton>
                            <SettingsButton onClick={() => handleCopy(slot)}>
                              {copiedId === slot.queueItemId ? "Copied" : "Copy"}
                            </SettingsButton>
                            {slot.status !== "sent" ? (
                              <>
                                <SettingsButton onClick={() => (isEditing ? setEditingId(null) : startEditing(slot))}>
                                  {isEditing ? "Cancel" : "Edit"}
                                </SettingsButton>
                                <SettingsButton
                                  variant="danger"
                                  disabled={isDismissing}
                                  onClick={() => void dismissSlot(slot)}
                                >
                                  {isDismissing ? "Replacing…" : "Don’t send"}
                                </SettingsButton>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 rounded-lg border border-[var(--csc-row-divider)] p-3">
                            <div>
                              <label className="block text-[11px] uppercase tracking-[0.14em] text-gray-400">
                                Subject
                              </label>
                              <input
                                type="text"
                                value={editSubject}
                                onChange={(e) => setEditSubject(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-1.5 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] uppercase tracking-[0.14em] text-gray-400">
                                Body (signature is appended automatically)
                              </label>
                              <textarea
                                rows={9}
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <SettingsButton
                                variant="primary"
                                disabled={savingEdit}
                                onClick={() => void saveEdit(slot)}
                              >
                                {savingEdit ? "Saving…" : "Save draft"}
                              </SettingsButton>
                              <SettingsButton disabled={savingEdit} onClick={() => setEditingId(null)}>
                                Cancel
                              </SettingsButton>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[var(--csc-row-divider)] px-3.5 py-3">
                            <p className="text-xs font-semibold text-white">
                              Subject: <span className="font-normal text-gray-200">{slot.subject || "(No subject)"}</span>
                            </p>
                            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-300">
                              {plainBody || "(Draft copy loading…)"}
                            </pre>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
