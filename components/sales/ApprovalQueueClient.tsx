"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { QueueItemDetail, RelationshipStage, ResearchFinding } from "@/lib/sales/types";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import { contactRoleDescription, fallbackRoleDescription } from "@/lib/sales/contacts/role-description";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";
import { NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import {
  applySelectContactResponse,
  applySelectedContact,
  applySentDraft,
  draftFromMutationPayload,
  isOpenDraftStatus,
  isSentDraftStatus,
} from "@/lib/sales/queue/optimistic";
import EmailLaunchLink from "@/components/sales/EmailLaunchLink";

type ActionKey = "approve" | "approve_with_edits" | "reject" | "defer" | "request_more_research" | "mark_duplicate";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400 border-emerald-700" : score >= 45 ? "text-amber-400 border-amber-700" : "text-gray-400 border-gray-700";
  return <span className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${color}`}>{score.toFixed(0)}</span>;
}

function findingForContact(
  findings: (ResearchFinding & { sourceUrl: string })[],
  contact: { fullName: string | null }
): (ResearchFinding & { sourceUrl: string }) | null {
  const name = (contact.fullName ?? "").trim();
  if (!name) return null;
  const first = name.split(/\s+/)[0];
  return (
    findings.find((f) => f.claimText.toLowerCase().includes(name.toLowerCase())) ??
    findings.find((f) => first.length > 2 && f.claimText.toLowerCase().includes(first.toLowerCase())) ??
    null
  );
}

export default function ApprovalQueueClient() {
  const [items, setItems] = useState<QueueItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailSendEnabled, setGmailSendEnabled] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCopyStatus = useCallback((message: string) => {
    if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current);
    setCopyStatus(message);
    copyStatusTimer.current = setTimeout(() => setCopyStatus(null), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyStatusTimer.current) clearTimeout(copyStatusTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/queue", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load queue");
      setItems(data.items ?? []);
      setGmailConnected(Boolean(data.gmail?.connected));
      setGmailEmail(data.gmail?.email ?? null);
      setGmailSendEnabled(Boolean(data.gmail?.sendsEnabled ?? data.gmail?.sendEnabled));
      setLoadError(null);
      setActionError(null);
      setSelectedIndex(0);
      setMobileDetailOpen(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[selectedIndex] ?? null;

  useEffect(() => {
    setSendConfirmOpen(false);
    setMenuOpenId(null);
    if (current?.draft) {
      setEditedSubject(current.draft.editedSubject ?? current.draft.aiSubject);
      setEditedBody(stripEmailSignature(current.draft.editedBody ?? current.draft.aiBody));
    }
  }, [current?.queueItem.id, current?.draft?.id]);

  const selectItem = useCallback((index: number) => {
    setSendConfirmOpen(false);
    setSelectedIndex(index);
    setMobileDetailOpen(true);
  }, []);

  const persistDraftSnapshot = useCallback(async (itemId: string, subject: string, body: string) => {
    const cleanedEditedBody = stripEmailSignature(body);
    const res = await fetch(`/api/sales/queue/${itemId}/save-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedSubject: subject, editedBody: cleanedEditedBody }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Save failed");
  }, []);

  const persistDraft = useCallback(async () => {
    if (!current?.draft) return;
    await persistDraftSnapshot(current.queueItem.id, editedSubject, editedBody);
  }, [current, editedSubject, editedBody, persistDraftSnapshot]);

  const selectContact = useCallback(
    (contactId: string) => {
      if (!current || current.contact?.id === contactId) return;
      setSendConfirmOpen(false);
      setMenuOpenId(null);
      setActionError(null);
      const itemId = current.queueItem.id;
      const prevSubject = editedSubject;
      const prevBody = editedBody;
      const switched = applySelectedContact(current, contactId);
      if (switched) {
        setItems((prev) => prev.map((item) => (item.queueItem.id === itemId ? switched : item)));
        const d = switched.draft;
        if (d) {
          setEditedSubject(d.editedSubject ?? d.aiSubject);
          setEditedBody(stripEmailSignature(d.editedBody ?? d.aiBody));
        }
      }
      void (async () => {
        try {
          await persistDraftSnapshot(itemId, prevSubject, prevBody).catch(() => undefined);
          const res = await fetch(`/api/sales/queue/${itemId}/select-contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Could not switch contact");
          setItems((prev) =>
            prev.map((item) => (item.queueItem.id === itemId ? applySelectContactResponse(item, data, contactId) : item))
          );
          const d = draftFromMutationPayload(data);
          if (d) {
            setEditedSubject(d.editedSubject ?? d.aiSubject);
            setEditedBody(stripEmailSignature(d.editedBody ?? d.aiBody));
          }
        } catch (err) {
          setActionError(err instanceof Error ? err.message : "Could not switch contact");
        }
      })();
    },
    [current, editedSubject, editedBody, persistDraftSnapshot]
  );

  const executeDecision = useCallback(
    async (action: ActionKey) => {
      if (!current || busy) return;

      const aiSubject = current.draft?.aiSubject ?? "";
      const aiBody = stripEmailSignature(current.draft?.aiBody ?? "");
      const cleanedEditedBody = stripEmailSignature(editedBody);
      const finalSubject = current.draft ? editedSubject : "";
      const finalBody = current.draft ? cleanedEditedBody : "";
      const differedFromAi =
        Boolean(current.draft) &&
        (finalSubject.trim() !== aiSubject.trim() || finalBody.trim() !== aiBody.trim());
      const isApprove = action === "approve" || action === "approve_with_edits";
      const effectiveAction: ActionKey =
        isApprove && differedFromAi ? "approve_with_edits" : action;

      if (
        !gmailConnected &&
        isApprove &&
        current.contact?.email &&
        current.draft &&
        !isOutboundEmailBlocked(current.contact.email)
      ) {
        const to = current.contact.email;
        launchMailto(buildMailtoUrl(to, finalSubject, finalBody));
        copyEmailToClipboard(to, finalSubject, finalBody).catch(() => undefined);
      }
      if (isApprove && current.contact?.email && isOutboundEmailBlocked(current.contact.email)) {
        setActionError(`Hard block: will not send to ${current.contact.email}.`);
        setSendConfirmOpen(false);
        return;
      }

      setBusy(true);
      setSendConfirmOpen(false);
      setActionError(null);
      try {
        const res = await fetch(`/api/sales/queue/${current.queueItem.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: effectiveAction,
            notes: null,
            ...(isApprove ? { confirmed: true } : {}),
            ...(isApprove && current.draft
              ? { editedSubject: finalSubject, editedBody: finalBody }
              : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Decision failed");
        if (data.gmail?.sent) showCopyStatus(`Sent via Gmail${data.gmail.email ? ` (${data.gmail.email})` : ""}`);
        if (data.remaining && data.detail) {
          const detail = data.detail as QueueItemDetail;
          setItems((prev) => prev.map((item) => (item.queueItem.id === current.queueItem.id ? detail : item)));
          const nextDraft = draftFromMutationPayload(data);
          if (nextDraft) {
            setEditedSubject(nextDraft.editedSubject ?? nextDraft.aiSubject);
            setEditedBody(stripEmailSignature(nextDraft.editedBody ?? nextDraft.aiBody));
          }
        } else {
          setItems((prev) => prev.filter((i) => i.queueItem.id !== current.queueItem.id));
          setSelectedIndex((i) => Math.min(i, Math.max(0, items.length - 2)));
          setMobileDetailOpen(false);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Decision failed");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, editedSubject, editedBody, items.length, showCopyStatus, gmailConnected]
  );

  const requestSend = useCallback(() => {
    if (!current || busy || !current.draft) return;
    const alreadySent = (current.contactDrafts ?? []).some(
      (d) => d.contactId === current.contact?.id && isSentDraftStatus(d.status)
    );
    if (alreadySent) return;
    setSendConfirmOpen(true);
  }, [current, busy]);

  const runMoreResearch = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setMenuOpenId(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/sales/queue/${current.queueItem.id}/more-research`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      if (data.detail) {
        setItems((prev) => prev.map((item) => (item.queueItem.id === current.queueItem.id ? data.detail : item)));
      }
      showCopyStatus("Research re-run finished — review updated contacts and draft.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }, [current, busy, showCopyStatus]);

  const hideContact = useCallback(
    async (contactId: string) => {
      if (!current || busy) return;
      setBusy(true);
      setMenuOpenId(null);
      const itemId = current.queueItem.id;
      try {
        const res = await fetch(`/api/sales/queue/${itemId}/skip-contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not skip contact");
        if (!data.remaining) {
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.queueItem.id === itemId);
            const next = prev.filter((i) => i.queueItem.id !== itemId);
            const nextIndex = Math.min(idx < 0 ? 0 : idx, Math.max(0, next.length - 1));
            setTimeout(() => setSelectedIndex(nextIndex), 0);
            return next;
          });
          setMobileDetailOpen(false);
          showCopyStatus("Last leftover contact skipped — org left the queue.");
          return;
        }
        const remainingContacts = (current.contacts ?? []).filter((c) => c.id !== contactId);
        setItems((prev) =>
          prev.map((item) => {
            if (item.queueItem.id !== itemId) return item;
            const without = { ...item, contacts: remainingContacts };
            return applySelectContactResponse(without, data, (data.nextContactId as string) || contactId);
          })
        );
        const nextDraft = draftFromMutationPayload(data);
        if (nextDraft) {
          setEditedSubject(nextDraft.editedSubject ?? nextDraft.aiSubject);
          setEditedBody(stripEmailSignature(nextDraft.editedBody ?? nextDraft.aiBody));
        }
        showCopyStatus("Skipped — they stay on the org, not emailed.");
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not skip contact");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, showCopyStatus]
  );

  const graduateOrg = useCallback(
    async (funnelStage?: RelationshipStage | null) => {
      if (!current || busy) return;
      setBusy(true);
      setMenuOpenId(null);
      setActionError(null);
      const itemId = current.queueItem.id;
      try {
        const res = await fetch(`/api/sales/queue/${itemId}/graduate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(funnelStage ? { funnelStage } : {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not move out of queue");
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.queueItem.id === itemId);
          const next = prev.filter((i) => i.queueItem.id !== itemId);
          const nextIndex = Math.min(idx < 0 ? 0 : idx, Math.max(0, next.length - 1));
          setTimeout(() => setSelectedIndex(nextIndex), 0);
          return next;
        });
        setMobileDetailOpen(false);
        const stageLabel = funnelStage
          ? FUNNEL_STAGES.find((s) => s.key === funnelStage)?.label ?? funnelStage
          : data.anySent
            ? "Funnel"
            : "Organizations";
        showCopyStatus(`Moved out of queue → ${stageLabel}. Remaining contacts were not emailed.`);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not move out of queue");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, showCopyStatus]
  );

  const moveFunnel = useCallback(
    (stage: RelationshipStage) => {
      void graduateOrg(stage);
    },
    [graduateOrg]
  );

  const markContactSent = useCallback(
    (contactId: string) => {
      if (!current) return;
      setMenuOpenId(null);
      setActionError(null);
      const itemId = current.queueItem.id;
      const snapshot = current;
      setItems((prev) => prev.map((item) => (item.queueItem.id === itemId ? applySentDraft(item, contactId) : item)));
      showCopyStatus(`Marked sent — stays in Awareness. Nudge in ${NUDGE_DUE_AFTER_DAYS} days if no reply.`);
      void (async () => {
        try {
          const res = await fetch(`/api/sales/queue/${itemId}/mark-sent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              ...(snapshot.contact?.id === contactId && snapshot.draft
                ? { editedSubject, editedBody: stripEmailSignature(editedBody) }
                : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Could not mark sent");
          if (!data.remaining) {
            setItems((prev) => {
              const idx = prev.findIndex((i) => i.queueItem.id === itemId);
              const next = prev.filter((i) => i.queueItem.id !== itemId);
              const nextIndex = Math.min(idx < 0 ? 0 : idx, Math.max(0, next.length - 1));
              setTimeout(() => setSelectedIndex(nextIndex), 0);
              return next;
            });
            setMobileDetailOpen(false);
          } else if (data.nextContactId || data.detail || data.draft) {
            setItems((prev) =>
              prev.map((item) => {
                if (item.queueItem.id !== itemId) return item;
                const sent = applySentDraft(item, contactId);
                const next = applySelectContactResponse(sent, data, (data.nextContactId as string) || contactId);
                const nextDraft = next.draft;
                if (nextDraft) {
                  setEditedSubject(nextDraft.editedSubject ?? nextDraft.aiSubject);
                  setEditedBody(stripEmailSignature(nextDraft.editedBody ?? nextDraft.aiBody));
                }
                return next;
              })
            );
          }
        } catch (err) {
          setItems((prev) => prev.map((item) => (item.queueItem.id === itemId ? snapshot : item)));
          setActionError(err instanceof Error ? err.message : "Could not mark sent");
        }
      })();
    },
    [current, editedSubject, editedBody, showCopyStatus]
  );

  const improveDraft = useCallback(async () => {
    if (!current?.draft || busy || improving) return;
    setImproving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sales/queue/${current.queueItem.id}/improve-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editedSubject, body: editedBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Improve failed");
      const saved = draftFromMutationPayload(data);
      if (!saved) throw new Error("Improve failed — no draft returned");
      setItems((prev) =>
        prev.map((item) => (item.queueItem.id === current.queueItem.id ? { ...item, draft: saved } : item))
      );
      setEditedSubject(saved.editedSubject ?? saved.aiSubject);
      setEditedBody(stripEmailSignature(saved.editedBody ?? saved.aiBody));
      showCopyStatus("AI rewrite saved as a draft — not sent. Edit further if you want.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Improve failed");
    } finally {
      setImproving(false);
    }
  }, [current, busy, improving, editedSubject, editedBody, showCopyStatus]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (sendConfirmOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSendConfirmOpen(false);
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
        setMobileDetailOpen(true);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
        setMobileDetailOpen(true);
      } else if (e.key === "Escape" && mobileDetailOpen) {
        e.preventDefault();
        setMobileDetailOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, mobileDetailOpen, sendConfirmOpen]);

  const pendingCount = items.length;
  const selectedAlreadySent = Boolean(
    current &&
      (current.contactDrafts ?? []).some(
        (d) => d.contactId === current.contact?.id && isSentDraftStatus(d.status)
      )
  );

  if (loading) return <p className="text-gray-400">Loading queue…</p>;
  if (loadError) return <p className="text-red-400">{loadError}</p>;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
        Queue is empty. Run the pipeline against an organization to generate reviewable opportunities.
      </div>
    );
  }

  return (
    <div>
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{actionError}</p>
      )}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className={`rounded-xl border border-gray-800 ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
        <div className="border-b border-gray-800 px-4 py-3 text-sm text-gray-400">{pendingCount} pending</div>
        <ul className="max-h-[75vh] overflow-y-auto overscroll-contain">
          {items.map((item, i) => (
            <li key={item.queueItem.id}>
              <button
                type="button"
                onClick={() => selectItem(i)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 border-b border-gray-800 px-4 py-3 text-left text-sm touch-manipulation ${
                  i === selectedIndex ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-900 active:bg-gray-800"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="block truncate font-medium">
                    {item.queueItem.kind === "nudge" && <span className="mr-1 text-amber-400">Nudge · </span>}
                    {item.organization.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{item.opportunity.title}</span>
                </span>
                {item.score ? (
                  <ScoreBadge score={item.score.totalScore} />
                ) : item.draft?.confidenceScore != null ? (
                  <span className="rounded-md border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                    {Math.round(item.draft.confidenceScore * 100)}%
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {current && (
        <div className={`rounded-xl border border-gray-800 p-4 sm:p-6 ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
          <button
            type="button"
            onClick={() => setMobileDetailOpen(false)}
            className="mb-4 inline-flex items-center gap-1 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 touch-manipulation lg:hidden"
          >
            ← Back to queue
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {current.queueItem.kind === "nudge" && (
                  <span className="mr-2 rounded-md border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-300">
                    Nudge
                  </span>
                )}
                {current.organization.name}
              </h2>
              <p className="text-sm text-gray-400">
                {current.organizationTypeLabel ?? "Type unknown"} · {current.opportunity.title}
                {current.opportunityTypeLabel ? ` (${current.opportunityTypeLabel})` : ""}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {gmailConnected ? (
                  <>
                    Gmail {gmailEmail ? `(${gmailEmail})` : "connected"}
                    {!gmailSendEnabled ? " · sends paused" : ""}
                    {" · "}
                    <Link href="/admin/sales" className="underline">
                      settings
                    </Link>
                  </>
                ) : (
                  <>
                    Gmail not connected ·{" "}
                    <Link href="/admin/sales" className="underline">
                      Connect
                    </Link>
                  </>
                )}
              </p>
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

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Contacts{(current.contacts?.length ?? 0) > 1 ? ` (${current.contacts.length})` : ""}
            </h3>
            {(current.contacts ?? []).length > 0 ? (
              <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(current.contacts ?? []).map((c) => {
                  const selected = current.contact?.id === c.id;
                  const sent = (current.contactDrafts ?? []).some(
                    (d) => d.contactId === c.id && isSentDraftStatus(d.status)
                  );
                  const hasDraft = !sent && (current.contactDrafts ?? []).some(
                    (d) => d.contactId === c.id && isOpenDraftStatus(d.status)
                  );
                  const blurb = contactRoleDescription(c) ?? fallbackRoleDescription(c.roleTitle);
                  const source = findingForContact(current.findings ?? [], c);
                  return (
                    <li key={c.id} className="relative">
                      <div
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          selected
                            ? "border-sky-600 bg-sky-950/40 text-white"
                            : "border-gray-800 bg-gray-900/40 text-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            disabled={busy || selected}
                            onClick={() => void selectContact(c.id)}
                            className="min-w-0 flex-1 text-left touch-manipulation disabled:opacity-100"
                          >
                            <span className="font-medium">
                              {c.fullName ?? "Unnamed"}
                              {sent ? (
                                <span className="ml-2 text-xs font-medium text-emerald-400">sent</span>
                              ) : hasDraft ? (
                                <span className="ml-2 text-xs text-gray-500">draft</span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400">{c.roleTitle ?? "unknown role"}</span>
                          </button>
                          <button
                            type="button"
                            aria-label="Contact actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId((id) => (id === c.id ? null : c.id));
                            }}
                            className="rounded px-1.5 py-0.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                          >
                            ⋯
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busy || selected}
                          onClick={() => void selectContact(c.id)}
                          className="mt-1 w-full text-left text-xs leading-snug text-gray-500 disabled:opacity-100"
                        >
                          {blurb}
                          <span className="mt-1 block text-gray-400">{c.email}</span>
                          {source?.sourceUrl && (
                            <a
                              href={source.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 inline-block text-gray-500 underline"
                            >
                              source
                            </a>
                          )}
                        </button>
                      </div>
                      {menuOpenId === c.id && (
                        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-gray-700 bg-gray-950 py-1 shadow-xl">
                          {!sent && (
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-sm font-medium text-emerald-400 hover:bg-gray-800"
                              onClick={() => void markContactSent(c.id)}
                            >
                              Sent
                            </button>
                          )}
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800"
                            onClick={() => {
                              setMenuOpenId(null);
                              void executeDecision("reject");
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800"
                            onClick={() => {
                              setMenuOpenId(null);
                              void executeDecision("defer");
                            }}
                          >
                            Defer
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800"
                            onClick={() => void runMoreResearch()}
                          >
                            More research
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800"
                            onClick={() => void hideContact(c.id)}
                          >
                            Skip — don’t email
                          </button>
                          <div className="my-1 border-t border-gray-800" />
                          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500">Move org out of queue</p>
                          {FUNNEL_STAGES.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800"
                              onClick={() => void moveFunnel(s.key)}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No contact identified yet.</p>
            )}
          </div>

          {current.brief && (
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/40 p-3">
              <p className="text-sm text-gray-100">{current.brief.summary}</p>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft email</h3>
              <div className="flex items-center gap-2">
                {current.draft && current.contact?.email && (
                  <EmailLaunchLink
                    to={current.contact.email}
                    subject={editedSubject || current.draft.aiSubject}
                    body={editedBody || current.draft.aiBody}
                  />
                )}
                <button
                  type="button"
                  disabled={busy || improving || !current.draft}
                  onClick={() => void improveDraft()}
                  className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                >
                  {improving ? "Improving…" : "Improve with AI"}
                </button>
              </div>
            </div>
            {current.draft ? (
              <div className="mt-2 space-y-2">
                <input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  onBlur={() => void persistDraft().catch(() => undefined)}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-white"
                />
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  onBlur={() => void persistDraft().catch(() => undefined)}
                  rows={12}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No draft yet.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !current.draft || !current.contact?.email || selectedAlreadySent}
              onClick={requestSend}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void graduateOrg()}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Done — skip remaining
            </button>
            {copyStatus && <span className="text-xs text-emerald-400">{copyStatus}</span>}
            <Link href={`/admin/sales/organizations/${current.organization.id}`} className="text-xs text-gray-500 underline">
              Organization
            </Link>
            <p className="basis-full text-xs text-gray-500">
              Done leaves the queue without emailing leftover people. They stay on the org.
            </p>
          </div>
        </div>
      )}

      {sendConfirmOpen && current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-xl">
            <h2 id="send-confirm-title" className="text-lg font-semibold text-white">
              Do you really want to send?
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              This will email{" "}
              <span className="font-medium text-white">{current.contact?.fullName ?? "the selected contact"}</span>
              {current.contact?.email ? (
                <>
                  {" "}
                  at <span className="text-sky-300">{current.contact.email}</span>
                </>
              ) : null}
              {gmailConnected && gmailSendEnabled
                ? " from your connected Gmail."
                : gmailConnected
                  ? " — Gmail sends are paused, so this will not go out via Gmail."
                  : " (opens your mail app / copies the draft — Gmail not connected)."}
            </p>
            <p className="mt-2 text-xs text-gray-500">Cancel keeps you browsing. Nothing sends until you confirm.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSendConfirmOpen(false)}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !current.draft || !current.contact?.email || selectedAlreadySent}
                onClick={() => void executeDecision("approve")}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Yes, send now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
