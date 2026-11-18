"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SettingsButton, SettingsPanel, StatusPill } from "@/components/settings/ui";
import type { AutoSendQueueView } from "@/lib/sales/autosend/view";

export default function AutoSendSettingsClient() {
  const [view, setView] = useState<AutoSendQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/sales/autosend", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load");
    setView(data as AutoSendQueueView);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/autosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update draft pipeline");
      setView(data as AutoSendQueueView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update draft pipeline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel
      eyebrow="Outreach"
      title="30-day $15k+ Gmail draft pipeline"
      description="Continuously builds a 30-business-day rolling lineup of $15k+ opportunities (20 large Anthem, 2 sponsorship, 3 partnership per day — zero school auctions or sub-$15k fillers) and pre-loads them into Gmail Drafts. Nothing auto-sends."
      actions={
        <>
          <StatusPill tone={view?.enabled ? "ok" : "off"}>{view?.enabled ? "On (24/7)" : "Paused"}</StatusPill>
          <SettingsButton href="/api/sales/gmail/connect?returnTo=/admin/settings/autosend">
            {view?.gmailConnected ? `Switch Gmail (${view.gmailEmail ?? "connected"})` : "Connect Gmail"}
          </SettingsButton>
          {view?.enabled ? (
            <SettingsButton variant="danger" disabled={busy} onClick={() => void setEnabled(false)}>
              {busy ? "Saving…" : "Pause"}
            </SettingsButton>
          ) : (
            <SettingsButton variant="primary" disabled={busy} onClick={() => void setEnabled(true)}>
              {busy ? "Saving…" : "Resume"}
            </SettingsButton>
          )}
        </>
      }
    >
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {view && !view.gmailComposeGranted ? (
        <p className="text-sm text-amber-200">
          Click Switch Gmail above (or under Google connections) and allow Gmail compose so drafts push directly into your Gmail Drafts folder. Every draft is already readable and editable in the live lineup.
        </p>
      ) : null}
      <p className="text-sm text-gray-300">
        {view
          ? `${view.totalDrafted} in Gmail Drafts · ${view.totalLinedUp} lined up across ${view.daysCovered} business days (window: ${view.horizonDays} business days).`
          : "Loading the 30-day lineup…"}
      </p>
      <p className="text-sm text-gray-400">
        Chapters, state associations, school auctions, sub-$15k local fundraisers, prior contacts across any opportunity, and calendar meeting contacts are automatically excluded. Removing a draft immediately promotes the next qualifying $15k+ lead.
      </p>
      <Link href="/admin/sales/autosend" className="csc-link text-sm">
        Open the $15k+ draft lineup →
      </Link>
    </SettingsPanel>
  );
}
