"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SettingsButton, SettingsPanel, StatusPill } from "@/components/settings/ui";
import { formatPacificWhen, LANE_LABEL } from "@/lib/sales/autosend/policy";
import { pnwSportsPriorityLabel, type PnwSportsPriorityTier } from "@/lib/sales/queue/pnw-sports-priority";
import { formatUsd } from "@/lib/sales/engines";
import { normalizeCrowdsourceWebsiteLinks } from "@/lib/sales/outreach/bookUrl";
import { draftToEmailHtml, draftToPlainText } from "@/lib/sales/outreach/email-body-format";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import {
  WEBSITE_HREF,
  ensureEmailSignature,
  ensureEmailSignatureHtml,
  stripEmailSignature,
} from "@/lib/sales/outreach/signature";
import type { AutoSendQueueView } from "@/lib/sales/autosend/view";
import type { AutoSendSlot } from "@/lib/sales/autosend/types";

function statusLabel(slot: AutoSendSlot): string {
  if (slot.status === "drafted") return "In Gmail Drafts";
  if (slot.status === "sent") return "Sent earlier";
  if (slot.status === "sending") return "Filing draft";
  if (slot.status === "failed") return "Failed";
  if (slot.status === "skipped") return "Skipped";
  return "Ready";
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

function renderPlainLineWithLinks(line: string, lineKey: string) {
  const tokenRe = /(https?:\/\/[^\s<]+|(?:www\.)?crowdsourcechoir\.com(?:\/[^\s<]*)?)/gi;
  const parts = line.split(tokenRe);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^(https?:\/\/[^\s<]+|(?:www\.)?crowdsourcechoir\.com(?:\/[^\s<]*)?)$/i.test(part)) {
      const trimmed = part.replace(/[),.;:!?]+$/g, "");
      const trailing = part.slice(trimmed.length);
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      return (
        <span key={`${lineKey}-${idx}`}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="csc-link underline"
          >
            {trimmed}
          </a>
          {trailing}
        </span>
      );
    }
    return <span key={`${lineKey}-${idx}`}>{part}</span>;
  });
}

export default function AutoSendQueueClient() {
  const [view, setView] = useState<AutoSendQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") !== "connected") return;
    const autoPush = params.get("autopush") === "1";
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    if (autoPush) {
      void runAction("draft_now", { action: "draft_now", maxToDraft: 10 }, (data) => {
        const t = (data.tick ?? {}) as { drafted?: number };
        return `Google compose connected — filed ${t.drafted ?? 0} draft(s) straight into your Gmail Drafts folder.`;
      });
    } else {
      setNotice("Gmail connected with draft permission.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRow(rowKey: string) {
    setExpandedIds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  }

  function expandOrCollapseAll(expand: boolean) {
    if (!view || !expand) {
      setExpandedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const group of view.groups) {
      for (const slot of group.slots) {
        next[`${group.key}-${slot.day}-${slot.queueItemId}`] = true;
      }
    }
    setExpandedIds(next);
  }

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

  function cleanBodyPlain(slot: AutoSendSlot): string {
    return normalizeCrowdsourceWebsiteLinks(
      stripEmailSignature(draftToPlainText(slot.body ?? ""))
    ).trim();
  }

  function startEditing(slot: AutoSendSlot, rowKey: string) {
    setExpandedIds((prev) => ({ ...prev, [rowKey]: true }));
    setEditingId(slot.queueItemId);
    setEditSubject(slot.subject || "");
    setEditBody(cleanBodyPlain(slot));
  }

  async function saveEdit(slot: AutoSendSlot) {
    setSavingEdit(true);
    setError(null);
    try {
      const normalizedEdit = normalizeCrowdsourceWebsiteLinks(editBody);
      const res = await fetch("/api/sales/autosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          queueItemId: slot.queueItemId,
          editedSubject: editSubject,
          editedBody: normalizedEdit,
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
    const clean = cleanBodyPlain(slot);
    const plain = ensureEmailSignature(clean);
    const html = ensureEmailSignatureHtml(draftToEmailHtml(clean));
    copyEmailToClipboard(slot.contactEmail, slot.subject, plain, html)
      .then(() => {
        setCopiedId(slot.queueItemId);
        window.setTimeout(() => setCopiedId((cur) => (cur === slot.queueItemId ? null : cur)), 3000);
      })
      .catch(() => setError("Clipboard copy failed."));
  }

  function handleMailto(slot: AutoSendSlot) {
    const plain = ensureEmailSignature(cleanBodyPlain(slot));
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
      const plain = ensureEmailSignature(cleanBodyPlain(slot));
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

  const anyExpanded = Object.values(expandedIds).some(Boolean);

  return (
    <div className="w-full text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Prospecting Intelligence · 30+ Day Rolling Draft Pipeline</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">$15k+ Outreach Drafts</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Click any row to expand the full email draft, edit inline, or open in Gmail. Click{" "}
            <span className="text-white">Don’t send</span> on any row and the next qualifying $15k+ lead immediately takes its place. Nothing auto-sends.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SettingsButton
            variant="primary"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("load_more", { action: "load_more", batchLimit: 4 }, (data) => {
                const s = (data.loadedSummary ?? {}) as {
                  newSeededOrgs?: number;
                  pipelineAttempted?: number;
                  pipelineSucceeded?: number;
                  awaitingQueued?: number;
                  draftedToGmail?: number;
                };
                return `Loaded ${s.newSeededOrgs ?? 0} new org(s), researched ${s.pipelineAttempted ?? 0}, advanced ${(s.pipelineSucceeded ?? 0) + (s.awaitingQueued ?? 0)}, and filed ${s.draftedToGmail ?? 0} Gmail draft(s).`;
              })
            }
          >
            {busyAction === "load_more" ? "Researching & loading leads…" : "Find & load more $15k+ leads now"}
          </SettingsButton>
          <SettingsButton
            variant={view?.gmailComposeGranted ? "primary" : "ghost"}
            disabled={busyAction !== null}
            href={
              view && !view.gmailComposeGranted
                ? "/api/sales/gmail/connect?returnTo=/admin/sales/autosend&autopush=1"
                : undefined
            }
            onClick={
              view?.gmailComposeGranted
                ? () =>
                    void runAction("draft_now", { action: "draft_now", maxToDraft: 10 }, (data) => {
                      const t = (data.tick ?? {}) as { drafted?: number };
                      return `Filed ${t.drafted ?? 0} draft(s) into Gmail Drafts (${view?.gmailEmail ?? "connected inbox"}).`;
                    })
                : undefined
            }
          >
            {busyAction === "draft_now"
              ? "Filing to Gmail…"
              : view && !view.gmailComposeGranted
                ? "Allow Gmail Drafts & Push 10"
                : "Push next 10 into Gmail Drafts"}
          </SettingsButton>
          <SettingsButton disabled={!view} onClick={() => expandOrCollapseAll(!anyExpanded)}>
            {anyExpanded ? "Collapse all" : "Expand all"}
          </SettingsButton>
          <SettingsButton disabled={!view} onClick={exportAllCsv}>
            Export CSV
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
              <SettingsButton
                href="/api/sales/gmail/connect?returnTo=/admin/sales/autosend&autopush=1"
                variant={view?.gmailComposeGranted ? "ghost" : "primary"}
              >
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
                  Click any row below to inspect, edit, copy, or dismiss drafts right now. Click{" "}
                  <a
                    href="/api/sales/gmail/connect?returnTo=/admin/sales/autosend&autopush=1"
                    className="csc-link underline"
                  >
                    Allow Gmail Drafts &amp; Push 10
                  </a>{" "}
                  once so Google grants draft-creation permission (`gmail.compose`) — your earlier Gmail login only granted send/read.
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
                    : "Grant Gmail compose above to push these drafts straight into your Gmail Drafts folder — click any row below to read the draft copy."
                  : "No leads in this section right now — click “Find & load more $15k+ leads now” above to keep filling."}
              </p>
            ) : (
              <ul className="csc-list mt-3">
                {group.slots.map((slot) => {
                  const rowKey = `${group.key}-${slot.day}-${slot.queueItemId}`;
                  const isExpanded = Boolean(expandedIds[rowKey]);
                  const bodyWithoutSig = cleanBodyPlain(slot);
                  const plainWithSig = ensureEmailSignature(bodyWithoutSig);
                  const isEditing = editingId === slot.queueItemId;
                  const isDismissing = dismissingId === slot.queueItemId;
                  const composeInConnected = gmailComposeNewUrl(
                    slot.contactEmail,
                    slot.subject,
                    plainWithSig,
                    view?.gmailEmail
                  );
                  const composeInAnyGmail = gmailComposeNewUrl(slot.contactEmail, slot.subject, plainWithSig, null);

                  return (
                    <li key={rowKey}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => toggleRow(rowKey)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(rowKey);
                          }
                        }}
                        className="csc-list-row"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-block w-4 shrink-0 text-center text-xs text-gray-400 transition-transform"
                          >
                            {isExpanded ? "▾" : "▸"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="truncate text-sm font-semibold text-white">
                                {slot.organizationName}
                              </span>
                              {slot.pnwSportsPriorityTier ? (
                                <span className="text-xs font-medium text-[var(--csc-accent)]">
                                  {pnwSportsPriorityLabel(slot.pnwSportsPriorityTier as PnwSportsPriorityTier)}
                                </span>
                              ) : null}
                              <span className="truncate text-xs text-gray-400">
                                {slot.contactName ? `${slot.contactName} · ` : ""}
                                {slot.contactEmail}
                              </span>
                              <span className="text-xs text-[var(--csc-accent)]">
                                {slot.suggestedFee ? formatUsd(slot.suggestedFee) : "$15k+"}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              <span className="text-gray-300">{slot.subject || slot.eventTitle}</span>
                              {" · "}
                              {formatPacificWhen(slot.sentAt ?? slot.scheduledAt)} Pacific · {LANE_LABEL[slot.lane]}
                              {slot.eventDate ? ` · ${slot.eventDate}` : ""} · score {Math.round(slot.score)}
                            </p>
                            {slot.error ? <p className="mt-0.5 text-xs text-amber-200">{slot.error}</p> : null}
                          </div>
                        </div>

                        <div
                          className="flex shrink-0 flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusPill tone={statusTone(slot)}>{statusLabel(slot)}</StatusPill>
                          {slot.draftUrl ? (
                            <SettingsButton href={slot.draftUrl} target="_blank" variant="primary">
                              Open draft
                            </SettingsButton>
                          ) : null}
                          {slot.status !== "sent" ? (
                            <SettingsButton
                              variant="danger"
                              disabled={isDismissing}
                              onClick={() => void dismissSlot(slot)}
                            >
                              {isDismissing ? "Replacing…" : "Don’t send"}
                            </SettingsButton>
                          ) : null}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-3 border-t border-[var(--csc-row-divider)] px-4 py-4 sm:pl-11">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-gray-400">
                              To: <span className="text-white">{slot.contactName ? `${slot.contactName} ` : ""}</span>
                              &lt;{slot.contactEmail}&gt;
                              {slot.eventTitle ? ` · ${slot.eventTitle}` : ""}
                              {" · "}
                              <Link
                                href={`/admin/sales/opportunities/${slot.opportunityId}`}
                                className="csc-link hover:underline"
                              >
                                Open opportunity →
                              </Link>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
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
                                <SettingsButton
                                  onClick={() =>
                                    isEditing ? setEditingId(null) : startEditing(slot, rowKey)
                                  }
                                >
                                  {isEditing ? "Cancel" : "Edit"}
                                </SettingsButton>
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
                                  Body (signature with linked Crowdsource Choir is appended automatically)
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
                            <div className="rounded-lg border border-[var(--csc-row-divider)] px-4 py-3">
                              <p className="text-xs font-semibold text-white">
                                Subject: <span className="font-normal text-gray-200">{slot.subject || "(No subject)"}</span>
                              </p>
                              <div className="mt-3 space-y-0.5 font-sans text-sm leading-relaxed text-gray-200">
                                {(bodyWithoutSig || "(Draft copy loading…)").split("\n").map((line, i) => (
                                  <p key={i} className="min-h-[1.25rem]">
                                    {line ? renderPlainLineWithLinks(line, `${rowKey}-line-${i}`) : "\u00A0"}
                                  </p>
                                ))}
                                <div className="pt-4 text-sm leading-snug text-gray-300">
                                  <p>--</p>
                                  <p>Joel DeJong</p>
                                  <p>
                                    Creator,{" "}
                                    <a
                                      href={WEBSITE_HREF}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="csc-link underline"
                                    >
                                      Crowdsource Choir
                                    </a>
                                  </p>
                                  <p>&apos;One of the Pacific Northwest&apos;s Most Talented Composers&apos;</p>
                                  <p>—American Songwriter</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
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
