"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { QueueItemDetail } from "@/lib/sales/types";
import { PERSONA_STRATEGIES } from "@/lib/sales/outreach/persona";
import { buildMailtoUrl, copyEmailToClipboard, launchMailto } from "@/lib/sales/outreach/mailto";
import { stripEmailSignature } from "@/lib/sales/outreach/signature";
import EmailLaunchLink from "@/components/sales/EmailLaunchLink";

type ActionKey = "approve" | "approve_with_edits" | "reject" | "defer" | "request_more_research" | "mark_duplicate";

const ACTIONS: { key: ActionKey; label: string; shortcut: string; tone: string }[] = [
  { key: "approve", label: "Approve & launch email", shortcut: "A", tone: "bg-emerald-600 hover:bg-emerald-500" },
  { key: "approve_with_edits", label: "Approve w/ edits & launch email", shortcut: "E", tone: "bg-emerald-800 hover:bg-emerald-700" },
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
  /** On phones, list and detail swap full-screen — tap a row to open detail, back to return. */
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
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
      setError(null);
      setSelectedIndex(0);
      setMobileDetailOpen(false);
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
    setSaveStatus(null);
    if (current?.draft) {
      setEditedSubject(current.draft.editedSubject ?? current.draft.aiSubject);
      setEditedBody(stripEmailSignature(current.draft.editedBody ?? current.draft.aiBody));
    }
  }, [current?.queueItem.id]);

  const selectItem = useCallback((index: number) => {
    setSelectedIndex(index);
    setMobileDetailOpen(true);
  }, []);

  const draftSubject = (draft: NonNullable<QueueItemDetail["draft"]>) =>
    draft.editedSubject ?? draft.aiSubject;
  const draftBody = (draft: NonNullable<QueueItemDetail["draft"]>) =>
    stripEmailSignature(draft.editedBody ?? draft.aiBody);

  const saveDraft = useCallback(async () => {
    if (!current?.draft || busy) return;
    setBusy(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/sales/queue/${current.queueItem.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editedSubject,
          editedBody: stripEmailSignature(editedBody),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save draft");
      const saved = data.draft as NonNullable<QueueItemDetail["draft"]>;
      setItems((prev) =>
        prev.map((item) =>
          item.queueItem.id === current.queueItem.id ? { ...item, draft: saved } : item
        )
      );
      setEditedSubject(saved.editedSubject ?? saved.aiSubject);
      setEditedBody(stripEmailSignature(saved.editedBody ?? saved.aiBody));
      setSaveStatus("Draft saved — still in queue. Approve when you’re ready to launch.");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setBusy(false);
    }
  }, [current, busy, editedSubject, editedBody]);

  const decide = useCallback(
    async (action: ActionKey) => {
      if (!current || busy) return;

      // Prefer in-progress editor values; otherwise whatever was last saved on the draft.
      const launchSubject =
        editing || action === "approve_with_edits"
          ? editedSubject
          : current.draft
            ? draftSubject(current.draft)
            : "";
      const launchBody =
        editing || action === "approve_with_edits"
          ? stripEmailSignature(editedBody)
          : current.draft
            ? draftBody(current.draft)
            : "";

      // Must happen synchronously in the click handler, before any `await` — browsers (Safari in
      // particular) only allow a mailto: navigation to open the OS mail client as a direct result
      // of a user gesture, and that permission is lost once control returns from an awaited
      // promise. Doing it first, before the decision API call below, is what makes "Approve"
      // double as "launch the email," not two separate clicks. Dispatching via a programmatically
      // clicked <a> (launchMailto), rather than reassigning window.location.href, is the more
      // broadly-reliable way browsers route mailto: navigation to a registered handler.
      if ((action === "approve" || action === "approve_with_edits") && current.contact?.email && current.draft) {
        const to = current.contact.email;
        launchMailto(buildMailtoUrl(to, launchSubject, launchBody));

        // We have no reliable signal on whether a mail client actually opened (a webmail handler
        // like Gmail only catches mailto: if explicitly granted permission in this browser — see
        // lib/sales/outreach/mailto.ts), so always also copy the draft to the clipboard as a
        // fallback the reviewer can paste into a fresh email.
        copyEmailToClipboard(to, launchSubject, launchBody)
          .then(() => showCopyStatus(`Draft copied to clipboard — paste into a new email to ${to} if your mail client didn't open.`))
          .catch(() => showCopyStatus("Couldn't copy the draft to your clipboard automatically."));
      }

      setBusy(true);
      try {
        const shouldPersistEdits =
          action === "approve_with_edits" ||
          (action === "approve" &&
            current.draft &&
            (editing ||
              !!(current.draft.editedSubject || current.draft.editedBody)));
        const res = await fetch(`/api/sales/queue/${current.queueItem.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: shouldPersistEdits && action === "approve" ? "approve_with_edits" : action,
            notes: notes || null,
            editedSubject: shouldPersistEdits ? launchSubject : undefined,
            editedBody: shouldPersistEdits ? launchBody : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Decision failed");
        setItems((prev) => prev.filter((i) => i.queueItem.id !== current.queueItem.id));
        setSelectedIndex((i) => Math.min(i, Math.max(0, items.length - 2)));
        setMobileDetailOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decision failed");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, notes, editedSubject, editedBody, items.length, showCopyStatus, editing]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (editing) {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          saveDraft();
        } else if (e.key.toLowerCase() === "s" && !inField) {
          e.preventDefault();
          saveDraft();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (current?.draft) {
            setEditedSubject(draftSubject(current.draft));
            setEditedBody(draftBody(current.draft));
          }
          setEditing(false);
        }
        return;
      }
      if (inField) return;
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
  }, [items.length, decide, editing, mobileDetailOpen, saveDraft, current]);

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

          {current.brief && (
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gut check</h3>
              <p className="mt-2 text-sm text-gray-100">{current.brief.summary}</p>
              <p className="mt-2 text-sm text-gray-300">
                <span className="text-gray-500">Angle: </span>
                {current.brief.recommendedAngle}
              </p>
              {current.brief.risks.length > 0 && (
                <p className="mt-2 text-sm text-amber-300/90">
                  <span className="text-amber-500/80">Risks: </span>
                  {current.brief.risks.join(" · ")}
                </p>
              )}
            </div>
          )}

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
                  <br />
                  <span className="text-xs text-sky-400">
                    Persona: {PERSONA_STRATEGIES[current.contact.outreachPersona].label} → goal:{" "}
                    {PERSONA_STRATEGIES[current.contact.outreachPersona].primaryGoal}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft email</h3>
              <div className="flex flex-wrap items-center gap-2">
                {current.draft && !editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-200 touch-manipulation hover:bg-gray-800"
                  >
                    Edit draft
                  </button>
                )}
                {current.draft && current.contact?.email && !editing && (
                  <EmailLaunchLink
                    to={current.contact.email}
                    subject={draftSubject(current.draft)}
                    body={draftBody(current.draft)}
                  />
                )}
              </div>
            </div>
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveDraft()}
                      className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white touch-manipulation hover:bg-sky-600 disabled:opacity-50"
                    >
                      Save draft <span className="ml-1 text-xs opacity-70">(S)</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditedSubject(draftSubject(current.draft!));
                        setEditedBody(draftBody(current.draft!));
                        setEditing(false);
                        setSaveStatus(null);
                      }}
                      className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 touch-manipulation hover:bg-gray-800 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Save keeps the item in the queue without sending. Your edits also train future AI drafts.
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-gray-800 bg-gray-900/60 p-3 text-sm text-gray-200">
                  {(current.draft.editedSubject || current.draft.editedBody) && (
                    <p className="mb-2 text-xs font-medium text-sky-400">Saved edits on this draft</p>
                  )}
                  <p className="font-medium">{draftSubject(current.draft)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-gray-300">{draftBody(current.draft)}</p>
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
                type="button"
                disabled={busy}
                onClick={() =>
                  action.key === "approve_with_edits" && !editing ? setEditing(true) : decide(action.key)
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white touch-manipulation disabled:opacity-50 ${action.tone}`}
              >
                {action.key === "approve_with_edits" && !editing
                  ? "Edit then approve & launch"
                  : action.label}{" "}
                <span className="ml-1 text-xs opacity-70">({action.shortcut})</span>
              </button>
            ))}
          </div>
          {saveStatus && <p className="mt-3 text-xs text-sky-400">{saveStatus}</p>}
          {copyStatus && <p className="mt-3 text-xs text-emerald-400">{copyStatus}</p>}
          <p className="mt-3 text-xs text-gray-500">
            Keyboard: <kbd>j</kbd>/<kbd>k</kbd> to move, <kbd>e</kbd> edit, <kbd>s</kbd> save draft (while editing),{" "}
            <kbd>a</kbd> approve &amp; launch email, <kbd>r</kbd> reject, <kbd>d</kbd> defer, <kbd>m</kbd> more research,{" "}
            <kbd>u</kbd> duplicate. Approving opens the draft in your default mail app — you send it from there. A link
            to the experience page (`/book`) is already in the draft body — pricing and other attachments wait until they
            reply. The full draft is also always copied to your clipboard as a backup.{" "}
            <Link href={`/admin/sales/organizations/${current.organization.id}`} className="underline">
              View organization
            </Link>
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Note: a webmail inbox (e.g. Gmail) only opens automatically if you’ve explicitly granted it mailto: handler permission in
            this browser — setting it as your OS’s default mail app isn’t enough. In Chrome, grant it via the address-bar prompt on
            gmail.com or under <code>chrome://settings/handlers</code>.
          </p>
        </div>
      )}
    </div>
  );
}
