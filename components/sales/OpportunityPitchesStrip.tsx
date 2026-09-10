"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsButton, StatusPill } from "@/components/settings/ui";

type PitchRow = {
  id: string;
  title: string;
  status: string;
  googleSlidesUrl: string | null;
  shareUrl: string;
  pdfStoragePath: string | null;
  promptText: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  googleSlidesTemplateFileId: string;
};

export default function OpportunityPitchesStrip({ opportunityId }: { opportunityId: string }) {
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [slidesGranted, setSlidesGranted] = useState<boolean | null>(null);
  const [promptText, setPromptText] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [listRes, statusRes] = await Promise.all([
      fetch(`/api/sales/pitches?opportunityId=${encodeURIComponent(opportunityId)}`, { cache: "no-store" }),
      fetch("/api/sales/pitches/status", { cache: "no-store" }),
    ]);
    const listData = await listRes.json();
    const statusData = await statusRes.json();
    if (!listRes.ok) throw new Error(listData.error ?? "Failed to load pitches");
    setPitches(listData.pitches ?? []);
    setTemplates(statusData.templates ?? []);
    setSlidesGranted(typeof statusData.slidesGranted === "boolean" ? statusData.slidesGranted : null);
  }, [opportunityId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function createPitch() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          promptText: promptText.trim() || null,
          templateId: templates[0]?.id ?? null,
          googleSlidesUrl: manualUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setPromptText("");
      setManualUrl("");
      setMessage("Pitch created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(id: string, action: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/sales/pitches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (action === "attach-draft") {
        setMessage(`Pitch link added to queue draft`);
      } else if (action === "export-pdf") {
        setMessage("PDF exported");
      } else {
        setMessage("Updated");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--csc-row-divider)] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="csc-eyebrow">Pitches</p>
          <p className="mt-1 text-xs text-gray-500">
            Google Slides decks for this opportunity. Edit in Slides — Octo tracks share + queue attach.
          </p>
        </div>
        {slidesGranted === false ? (
          <StatusPill tone="warn">Slides not granted</StatusPill>
        ) : slidesGranted ? (
          <StatusPill tone="ok">Slides ready</StatusPill>
        ) : null}
      </div>

      {slidesGranted === false ? (
        <p className="mt-3 text-sm text-amber-200">
          Reconnect Google in{" "}
          <a href="/admin/settings/gmail" className="csc-link underline">
            Settings → Google connections
          </a>{" "}
          and allow Slides + Drive. Or paste an existing Slides URL below.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={2}
          placeholder="Optional angle / fit blurb for {{fit_blurb}} placeholder"
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600"
        />
        <input
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="Optional: paste existing Google Slides URL"
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600"
        />
        <SettingsButton variant="primary" disabled={busy} onClick={() => void createPitch()}>
          {templates.length || slidesGranted ? "Create pitch" : "Create pitch shell"}
        </SettingsButton>
        {templates.length === 0 ? (
          <p className="text-xs text-gray-500">
            No template yet — add a master deck file id under Settings → Google connections (Pitches), or paste a
            Slides URL above.
          </p>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

      <ul className="mt-4 space-y-3">
        {pitches.length === 0 ? (
          <li className="text-sm text-gray-500">No pitches yet.</li>
        ) : (
          pitches.map((pitch) => (
            <li key={pitch.id} className="rounded-lg border border-white/10 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{pitch.title}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <StatusPill tone={pitch.status === "shared" || pitch.status === "ready" ? "ok" : "neutral"}>
                      {pitch.status}
                    </StatusPill>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pitch.googleSlidesUrl ? (
                    <SettingsButton href={pitch.googleSlidesUrl}>Edit in Slides</SettingsButton>
                  ) : null}
                  <SettingsButton
                    onClick={() => {
                      void navigator.clipboard.writeText(pitch.shareUrl);
                      setMessage("Share link copied");
                    }}
                  >
                    Copy share link
                  </SettingsButton>
                  <SettingsButton disabled={busy} onClick={() => void runAction(pitch.id, "attach-draft")}>
                    Add to draft
                  </SettingsButton>
                  {pitch.googleSlidesUrl ? (
                    <SettingsButton disabled={busy} onClick={() => void runAction(pitch.id, "export-pdf")}>
                      Export PDF
                    </SettingsButton>
                  ) : null}
                  {pitch.pdfStoragePath ? (
                    <SettingsButton href={`/api/sales/pitches/${pitch.id}?download=pdf`}>
                      Download PDF
                    </SettingsButton>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-gray-500">{pitch.shareUrl}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
