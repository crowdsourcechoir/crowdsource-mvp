"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { QueueItemDetail, QueueSidebarItem, RelationshipStage, ResearchFinding } from "@/lib/sales/types";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { draftToEmailHtml, draftToPlainText, coalesceDraftBody, coalesceDraftSubject, isBlankEmailBody } from "@/lib/sales/outreach/email-body-format";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import QueueEmailBodyEditor from "@/components/sales/QueueEmailBodyEditor";
import { contactRoleDescription, fallbackRoleDescription } from "@/lib/sales/contacts/role-description";
import { isOutboundEmailBlocked } from "@/lib/sales/outreach/send-blocklist";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";
import { NUDGE_DUE_AFTER_DAYS } from "@/lib/sales/gmail/constants";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import type { SalesSearchHit } from "@/lib/sales/search/query";
import {
  QUEUE_CATEGORY_CHIPS,
  countQueueCategories,
  matchesQueueCategory,
  parseQueueCategory,
  queueCategoryLabel,
  type QueueCategoryFilter,
} from "@/lib/sales/queue/category";
import {
  applySelectContactResponse,
  applySelectedContact,
  applySentDraft,
  draftFromMutationPayload,
  isOpenDraftStatus,
  isSentDraftStatus,
  type QueueMutationPayload,
} from "@/lib/sales/queue/optimistic";
import EmailLaunchLink from "@/components/sales/EmailLaunchLink";
import AddOrganizationForm, { AddOrgPlusButton } from "@/components/sales/AddOrganizationForm";
import AddContactForm from "@/components/sales/AddContactForm";
import SalesSearchBox from "@/components/sales/SalesSearchBox";
import FindMoreContactsForm from "@/components/sales/FindMoreContactsForm";
import FollowUpControls from "@/components/sales/FollowUpControls";
import GmailThreadLink from "@/components/sales/GmailThreadLink";
import { formatFollowUpDay } from "@/lib/sales/follow-up/calendar";
import { outreachLabel } from "@/lib/sales/outreach/contact-outreach";
import { parseQueueScope, QUEUE_SCOPE_CHIPS, type QueueScope } from "@/lib/sales/queue/scope";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = parseQueueCategory(searchParams.get("category"));
  const scope = parseQueueScope(searchParams.get("scope"));
  const deepLinkItem = searchParams.get("item");
  const [sidebar, setSidebar] = useState<QueueSidebarItem[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, QueueItemDetail>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<{ id: string; message: string } | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);
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
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [jumpToQueueItemId, setJumpToQueueItemId] = useState<string | null>(null);
  const [findContactsOpen, setFindContactsOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendInFlight = useRef(false);
  const draftIdentityRef = useRef("");

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
      const res = await fetch(`/api/sales/queue?scope=${encodeURIComponent(scope)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load queue"));
      const body = data as { items?: QueueSidebarItem[]; gmail?: { connected?: boolean; email?: string | null; sendsEnabled?: boolean; sendEnabled?: boolean } };
      setSidebar(body.items ?? []);
      setDetailsById({});
      setGmailConnected(Boolean(body.gmail?.connected));
      setGmailEmail(body.gmail?.email ?? null);
      setGmailSendEnabled(Boolean(body.gmail?.sendsEnabled ?? body.gmail?.sendEnabled));
      setLoadError(null);
      setActionError(null);
      setDetailError(null);
      setSelectedIndex(0);
      setMobileDetailOpen(false);
      if (deepLinkItem) setJumpToQueueItemId(deepLinkItem);
    } catch (err) {
      setLoadError(publicErrorMessage(err, "Failed to load queue"));
    } finally {
      setLoading(false);
    }
  }, [scope, deepLinkItem]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => sidebar.filter((item) => matchesQueueCategory(item, category)),
    [sidebar, category]
  );
  const categoryCounts = useMemo(() => countQueueCategories(sidebar), [sidebar]);

  const selected = visible[selectedIndex] ?? null;
  const selectedId = selected?.queueItem.id ?? null;
  const current = selectedId ? detailsById[selectedId] ?? null : null;

  const draftIdentity = `${current?.queueItem.id ?? ""}:${current?.draft?.id ?? ""}`;
  if (draftIdentityRef.current !== draftIdentity) {
    draftIdentityRef.current = draftIdentity;
    if (current?.draft) {
      setEditedSubject(coalesceDraftSubject(current.draft.editedSubject, current.draft.aiSubject));
      setEditedBody(stripEmailSignature(coalesceDraftBody(current.draft.editedBody, current.draft.aiBody)));
    } else {
      setEditedSubject("");
      setEditedBody("");
    }
  }

  const replaceDetail = useCallback((itemId: string, next: QueueItemDetail) => {
    setDetailsById((prev) => ({ ...prev, [itemId]: next }));
  }, []);

  const dropQueueRow = useCallback((itemId: string) => {
    setSidebar((prev) => prev.filter((row) => row.queueItem.id !== itemId));
    setDetailsById((prev) => {
      const { [itemId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  useEffect(() => {
    if (selectedIndex >= visible.length) {
      setSelectedIndex(Math.max(0, visible.length - 1));
    }
  }, [visible.length, selectedIndex]);

  useEffect(() => {
    if (!selectedId || current) {
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/sales/queue/${selectedId}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(apiErrorFromBody(data, "Failed to load this organization"));
        if (cancelled) return;
        const detail = (data as { detail?: QueueItemDetail }).detail;
        if (!detail?.queueItem) throw new Error("Failed to load this organization");
        replaceDetail(selectedId, detail);
        setDetailError(null);
      } catch (err) {
        if (!cancelled) {
          setDetailError({
            id: selectedId,
            message: publicErrorMessage(err, "Failed to load this organization"),
          });
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, current, replaceDetail, detailNonce]);

  useEffect(() => {
    setSendConfirmOpen(false);
    setFindContactsOpen(false);
    setMenuOpenId(null);
  }, [current?.queueItem.id, current?.draft?.id]);

  const selectItem = useCallback((index: number) => {
    setSendConfirmOpen(false);
    setFindContactsOpen(false);
    setSelectedIndex(index);
    setMobileDetailOpen(true);
  }, []);

  const pickFromSearch = useCallback(
    (hit: SalesSearchHit) => {
      if (hit.queueItemId) {
        const inVisible = visible.findIndex((row) => row.queueItem.id === hit.queueItemId);
        if (inVisible >= 0) {
          selectItem(inVisible);
          return;
        }
        if (sidebar.some((row) => row.queueItem.id === hit.queueItemId)) {
          setJumpToQueueItemId(hit.queueItemId);
          setCategory("all");
          return;
        }
        if (scope !== "all") {
          setJumpToQueueItemId(hit.queueItemId);
          setScope("all");
          return;
        }
      }
      router.push(`/admin/sales/organizations/${hit.organizationId}`);
    },
    [visible, sidebar, selectItem, router, scope]
  );

  useEffect(() => {
    if (!jumpToQueueItemId) return;
    const idx = visible.findIndex((row) => row.queueItem.id === jumpToQueueItemId);
    if (idx >= 0) {
      selectItem(idx);
      setJumpToQueueItemId(null);
    }
  }, [jumpToQueueItemId, visible, selectItem]);

  const persistDraftSnapshot = useCallback(async (itemId: string, subject: string, body: string) => {
    const cleanedEditedBody = stripEmailSignature(body);
    const res = await fetch(`/api/sales/queue/${itemId}/save-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedSubject: subject, editedBody: cleanedEditedBody }),
    });
    const data = await readApiJson(res);
    if (!res.ok) throw new Error(apiErrorFromBody(data, "Save failed"));
  }, []);

  const persistDraft = useCallback(async () => {
    if (!current?.draft) return;
    if (isBlankEmailBody(editedBody) && !isBlankEmailBody(current.draft.aiBody)) return;
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
        replaceDetail(itemId, switched);
        const d = switched.draft;
        if (d) {
          setEditedSubject(coalesceDraftSubject(d.editedSubject, d.aiSubject));
          setEditedBody(stripEmailSignature(coalesceDraftBody(d.editedBody, d.aiBody)));
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
          const data = (await readApiJson(res)) as QueueMutationPayload;
          if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not switch contact"));
          setDetailsById((prev) => {
            const item = prev[itemId];
            if (!item) return prev;
            return { ...prev, [itemId]: applySelectContactResponse(item, data, contactId) };
          });
          const d = draftFromMutationPayload(data);
          if (d) {
            setEditedSubject(coalesceDraftSubject(d.editedSubject, d.aiSubject));
            setEditedBody(stripEmailSignature(coalesceDraftBody(d.editedBody, d.aiBody)));
          }
        } catch (err) {
          setActionError(publicErrorMessage(err, "Could not switch contact"));
        }
      })();
    },
    [current, editedSubject, editedBody, persistDraftSnapshot, replaceDetail]
  );

  const executeDecision = useCallback(
    async (action: ActionKey) => {
      if (!current || busy || sendInFlight.current) return;

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
        const plainBody = draftToPlainText(finalBody);
        launchMailto(buildMailtoUrl(to, finalSubject, plainBody));
        copyEmailToClipboard(to, finalSubject, plainBody, draftToEmailHtml(finalBody)).catch(() => undefined);
      }
      if (isApprove && current.contact?.email && isOutboundEmailBlocked(current.contact.email)) {
        setActionError(`Hard block: will not send to ${current.contact.email}.`);
        setSendConfirmOpen(false);
        return;
      }

      if (isApprove) sendInFlight.current = true;
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
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(apiErrorFromBody(data, "Decision failed"));
        const body = data as { remaining?: boolean; detail?: QueueItemDetail; gmail?: { sent?: boolean; email?: string } };
        if (body.gmail?.sent) showCopyStatus(`Sent via Gmail${body.gmail.email ? ` (${body.gmail.email})` : ""}`);
        if (body.remaining && body.detail) {
          replaceDetail(current.queueItem.id, body.detail);
          const nextDraft = draftFromMutationPayload(body);
          if (nextDraft) {
            setEditedSubject(coalesceDraftSubject(nextDraft.editedSubject, nextDraft.aiSubject));
            setEditedBody(stripEmailSignature(coalesceDraftBody(nextDraft.editedBody, nextDraft.aiBody)));
          }
        } else {
          dropQueueRow(current.queueItem.id);
          setMobileDetailOpen(false);
        }
      } catch (err) {
        setActionError(publicErrorMessage(err, "Decision failed"));
      } finally {
        sendInFlight.current = false;
        setBusy(false);
      }
    },
    [current, busy, editedSubject, editedBody, showCopyStatus, gmailConnected, replaceDetail, dropQueueRow]
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
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Research failed"));
      const detail = (data as { detail?: QueueItemDetail }).detail;
      if (detail) replaceDetail(current.queueItem.id, detail);
      showCopyStatus("Research re-run finished — review updated contacts and draft.");
    } catch (err) {
      setActionError(publicErrorMessage(err, "Research failed"));
    } finally {
      setBusy(false);
    }
  }, [current, busy, showCopyStatus, replaceDetail]);

  const hideContact = useCallback(
    async (contactId: string) => {
      if (!current || busy) return;
      setBusy(true);
      setMenuOpenId(null);
      try {
        const res = await fetch(`/api/sales/contacts/${contactId}`, { method: "DELETE" });
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not hide contact"));
        const remaining = (current.contacts ?? []).filter((c) => c.id !== contactId);
        const next = remaining[0];
        if (next && next.id !== current.contact?.id) {
          await selectContact(next.id);
        } else {
          replaceDetail(current.queueItem.id, { ...current, contacts: remaining });
        }
        showCopyStatus("Contact hidden from this list.");
      } catch (err) {
        setActionError(publicErrorMessage(err, "Could not hide contact"));
      } finally {
        setBusy(false);
      }
    },
    [current, busy, selectContact, showCopyStatus, replaceDetail]
  );

  const moveFunnel = useCallback(
    (stage: RelationshipStage) => {
      if (!current) return;
      setMenuOpenId(null);
      const itemId = current.queueItem.id;
      const previous = current.opportunity.relationshipStage;
      replaceDetail(itemId, { ...current, opportunity: { ...current.opportunity, relationshipStage: stage } });
      showCopyStatus(`Moved to ${FUNNEL_STAGES.find((s) => s.key === stage)?.label ?? stage}.`);
      void (async () => {
        try {
          const res = await fetch(`/api/sales/opportunities/${current.opportunity.id}/stage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage }),
          });
          const data = await readApiJson(res);
          if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not move funnel"));
        } catch (err) {
          replaceDetail(itemId, { ...current, opportunity: { ...current.opportunity, relationshipStage: previous } });
          setActionError(publicErrorMessage(err, "Could not move funnel"));
        }
      })();
    },
    [current, showCopyStatus, replaceDetail]
  );

  const markContactSent = useCallback(
    (contactId: string) => {
      if (!current) return;
      setMenuOpenId(null);
      setActionError(null);
      const itemId = current.queueItem.id;
      const snapshot = current;
      replaceDetail(itemId, applySentDraft(current, contactId));
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
          const data = (await readApiJson(res)) as QueueMutationPayload;
          if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not mark sent"));
          if (!data.remaining) {
            dropQueueRow(itemId);
            setMobileDetailOpen(false);
          } else if (data.nextContactId || data.detail || data.draft) {
            setDetailsById((prev) => {
              const item = prev[itemId] ?? snapshot;
              const sent = applySentDraft(item, contactId);
              const next = applySelectContactResponse(sent, data, data.nextContactId || contactId);
              const nextDraft = next.draft;
              if (nextDraft) {
                setEditedSubject(coalesceDraftSubject(nextDraft.editedSubject, nextDraft.aiSubject));
                setEditedBody(stripEmailSignature(coalesceDraftBody(nextDraft.editedBody, nextDraft.aiBody)));
              }
              return { ...prev, [itemId]: next };
            });
          }
        } catch (err) {
          replaceDetail(itemId, snapshot);
          setActionError(publicErrorMessage(err, "Could not mark sent"));
        }
      })();
    },
    [current, editedSubject, editedBody, showCopyStatus, replaceDetail, dropQueueRow]
  );

  const improveDraft = useCallback(async () => {
    if (!current?.draft || busy || improving) return;
    setImproving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sales/queue/${current.queueItem.id}/improve-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editedSubject, body: draftToPlainText(editedBody) }),
      });
      const data = (await readApiJson(res)) as QueueMutationPayload;
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Improve failed"));
      const saved = draftFromMutationPayload(data);
      if (!saved) throw new Error("Improve failed — no draft returned");
      replaceDetail(current.queueItem.id, { ...current, draft: saved });
      setEditedSubject(coalesceDraftSubject(saved.editedSubject, saved.aiSubject));
      setEditedBody(stripEmailSignature(coalesceDraftBody(saved.editedBody, saved.aiBody)));
      showCopyStatus("AI rewrite saved as a draft — not sent. Edit further if you want.");
    } catch (err) {
      setActionError(publicErrorMessage(err, "Improve failed"));
    } finally {
      setImproving(false);
    }
  }, [current, busy, improving, editedSubject, editedBody, showCopyStatus, replaceDetail]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (sendConfirmOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSendConfirmOpen(false);
        }
        return;
      }
      if (findContactsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setFindContactsOpen(false);
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (target?.closest("input, textarea, select, [contenteditable='true'], .ProseMirror")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(Math.max(0, visible.length - 1), i + 1));
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
  }, [visible.length, mobileDetailOpen, sendConfirmOpen, findContactsOpen]);

  useEffect(() => {
    if (jumpToQueueItemId) return;
    setSelectedIndex(0);
    setMobileDetailOpen(false);
  }, [category, scope]);

  function setCategory(next: QueueCategoryFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("category");
    else params.set("category", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setScope(next: QueueScope) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "to_send") params.delete("scope");
    else params.set("scope", next);
    params.delete("item");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const pendingCount = visible.length;
  const selectedAlreadySent = Boolean(
    current &&
      (current.contactDrafts ?? []).some(
        (d) => d.contactId === current.contact?.id && isSentDraftStatus(d.status)
      )
  );

  const addOrgModal = (
    <AddOrganizationForm open={addOrgOpen} onClose={() => setAddOrgOpen(false)} onQueued={() => void load()} />
  );

  const filterBar = (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {QUEUE_SCOPE_CHIPS.map((chip) => {
          const active = scope === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setScope(chip.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-[#CFFF81] text-gray-900" : "border border-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {QUEUE_CATEGORY_CHIPS.map((chip) => {
          const active = category === chip.key;
          const count = categoryCounts[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setCategory(chip.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-white text-gray-900" : "border border-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              {chip.label}
              <span className={`ml-1.5 ${active ? "text-gray-500" : "text-gray-500"}`}>{count}</span>
            </button>
          );
        })}
        </div>
      <SalesSearchBox onPick={pickFromSearch} />
      <AddOrgPlusButton onClick={() => setAddOrgOpen(true)} />
    </div>
    </div>
  );

  if (loading) {
    return (
      <div>
        {filterBar}
        {addOrgModal}
        <p className="text-gray-400">Loading queue…</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div>
        {filterBar}
        {addOrgModal}
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6">
          <p className="text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md border border-red-700 px-3 py-1.5 text-sm text-red-100 hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sidebar.length === 0) {
    return (
      <div>
        {filterBar}
        {addOrgModal}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-400">
          Queue is empty. Add an organization with +.
        </div>
      </div>
    );
  }

  return (
    <div>
      {filterBar}
      {addOrgModal}
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{actionError}</p>
      )}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className={`rounded-xl border border-gray-800 ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
        <div className="border-b border-gray-800 px-4 py-3 text-sm text-gray-400">
          {scope === "due"
            ? `${pendingCount} due today`
            : scope === "all"
              ? `${pendingCount} orgs`
              : category === "all"
                ? `${pendingCount} to send`
                : `${pendingCount} ${queueCategoryLabel(category).toLowerCase()} · ${sidebar.length} total`}
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No {queueCategoryLabel(category).toLowerCase()} in the queue.
          </p>
        ) : (
        <ul className="max-h-[75vh] overflow-y-auto overscroll-contain">
          {visible.map((item, i) => (
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
                    {item.organizationName}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{item.opportunityTitle}</span>
                  <span className="mt-0.5 block truncate text-[11px] uppercase tracking-wide text-gray-600">
                    {queueCategoryLabel(parseQueueCategory(item.category))}
                    {item.outreachKind === "replied" ? " · replied" : item.outreachKind === "sent" ? " · sent" : item.outreachKind === "bounced" ? " · bounced" : ""}
                    {item.followUpDue ? " · due" : item.nextFollowUpAt ? ` · ${formatFollowUpDay(item.nextFollowUpAt)}` : ""}
                  </span>
                </span>
                {item.totalScore != null ? (
                  <ScoreBadge score={item.totalScore} />
                ) : item.draftConfidence != null ? (
                  <span className="rounded-md border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                    {Math.round(item.draftConfidence * 100)}%
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        )}
      </div>

      {(current || selected) && (
        <div className={`rounded-xl border border-gray-800 p-4 sm:p-6 ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
          <button
            type="button"
            onClick={() => setMobileDetailOpen(false)}
            className="mb-4 inline-flex items-center gap-1 rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-200 touch-manipulation lg:hidden"
          >
            ← Back to queue
          </button>

          {!current && (
            <div>
              <h2 className="text-xl font-semibold text-white">{selected?.organizationName}</h2>
              <p className="text-sm text-gray-400">{selected?.opportunityTitle}</p>
              {detailLoading || detailError?.id !== selectedId ? (
                <p className="mt-4 text-sm text-gray-400">Loading contacts…</p>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-red-300">{detailError?.message ?? "Could not load this organization."}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailError(null);
                      setDetailNonce((n) => n + 1);
                    }}
                    className="mt-3 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {current && (
          <>
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
                  const outreach = current.contactOutreach?.[c.id];
                  const outreachChip = outreachLabel(outreach);
                  const hasDraft = !sent && !outreach?.sentAt && (current.contactDrafts ?? []).some(
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
                              {outreachChip ? (
                                <span className={`ml-2 text-xs font-medium ${outreachChip.className}`}>{outreachChip.text}</span>
                              ) : sent ? (
                                <span className="ml-2 text-xs font-medium text-emerald-400">sent</span>
                              ) : hasDraft ? (
                                <span className="ml-2 text-xs text-gray-500">draft</span>
                              ) : null}
                              {c.emailVerificationStatus === "verified_deliverable" ? (
                                <span className="ml-2 text-xs font-medium text-emerald-400">verified</span>
                              ) : c.emailVerificationStatus === "invalid" ? (
                                <span className="ml-2 text-xs font-medium text-red-400">bounce</span>
                              ) : (
                                <span className="ml-2 text-xs text-amber-400">unverified</span>
                              )}
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
                          {outreach?.snippet ? (
                            <span className="mt-1 block line-clamp-3 text-gray-300">{outreach.snippet}</span>
                          ) : null}
                          {outreach?.gmailThreadId || ((sent || outreach?.sentAt) && current.opportunity.gmailThreadId) ? (
                            <span className="mt-1 block" onClick={(e) => e.stopPropagation()}>
                              <GmailThreadLink
                                threadId={outreach?.gmailThreadId || current.opportunity.gmailThreadId || ""}
                                accountEmail={gmailEmail}
                                className="text-sky-400 underline"
                              >
                                Open this thread
                              </GmailThreadLink>
                            </span>
                          ) : null}
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
                            Delete
                          </button>
                          <div className="my-1 border-t border-gray-800" />
                          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500">Move to</p>
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
            {current.queueItem.status === "pending" && (
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <AddContactForm
                  itemId={current.queueItem.id}
                  onAdded={(detail, message) => {
                    if (detail) {
                      replaceDetail(current.queueItem.id, detail);
                      const d = detail.draft;
                      if (d) {
                        setEditedSubject(coalesceDraftSubject(d.editedSubject, d.aiSubject));
                        setEditedBody(stripEmailSignature(coalesceDraftBody(d.editedBody, d.aiBody)));
                      }
                    }
                    showCopyStatus(message);
                  }}
                />
                <FindMoreContactsForm
                  itemId={current.queueItem.id}
                  orgName={current.organization.name}
                  domainHint={current.organization.domain ?? current.organization.websiteUrl}
                  open={findContactsOpen}
                  onOpenChange={setFindContactsOpen}
                  onFound={(detail, message) => {
                    if (detail) {
                      replaceDetail(current.queueItem.id, detail);
                      const d = detail.draft;
                      if (d) {
                        setEditedSubject(coalesceDraftSubject(d.editedSubject, d.aiSubject));
                        setEditedBody(stripEmailSignature(coalesceDraftBody(d.editedBody, d.aiBody)));
                      }
                    }
                    showCopyStatus(message);
                  }}
                />
              </div>
            )}
          </div>

          {current.opportunity.id ? (
            <div className="mt-4">
              <FollowUpControls
                opportunityId={current.opportunity.id}
                nextFollowUpAt={current.opportunity.nextFollowUpAt}
                onSaved={(nextFollowUpAt) => {
                  replaceDetail(current.queueItem.id, {
                    ...current,
                    opportunity: { ...current.opportunity, nextFollowUpAt },
                  });
                }}
              />
            </div>
          ) : null}

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
                <QueueEmailBodyEditor
                  value={editedBody}
                  contentKey={draftIdentity}
                  onChange={setEditedBody}
                  onBlur={() => void persistDraft().catch(() => undefined)}
                  disabled={busy || improving}
                  improving={improving}
                  onImprove={() => void improveDraft()}
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
            {copyStatus && <span className="text-xs text-emerald-400">{copyStatus}</span>}
            <Link href={`/admin/sales/organizations/${current.organization.id}`} className="text-xs text-gray-500 underline">
              Organization
            </Link>
          </div>
          </>
          )}
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
