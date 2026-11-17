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
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update weekday drafts");
      setView(data as AutoSendQueueView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update weekday drafts");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel
      eyebrow="Outreach"
      title="Weekday Gmail drafts"
      description="On files the weekday mix as Gmail drafts between 8:00am and 5:00pm Pacific: 18 large ($15k+), 2 sponsorship, 3 partnership, and 2 other. Nothing is auto-sent — you review and send each draft in Gmail. School auctions only fill Other. Off keeps the line and files nothing."
      actions={
        <>
          <StatusPill tone={view?.enabled ? "ok" : "off"}>{view?.enabled ? "On" : "Paused"}</StatusPill>
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
          Reconnect Google under{" "}
          <Link href="/admin/settings/gmail" className="csc-link">
            Google connections
          </Link>{" "}
          and allow Gmail compose. Until then this line creates nothing and does not send.
        </p>
      ) : null}
      <p className="text-sm text-gray-300">
        {view
          ? `${view.draftedToday} drafted today · ${view.sentToday} sent earlier · ${view.weekSent} of ${view.weeklyCap} this week.`
          : "Loading the line…"}
      </p>
      <p className="text-sm text-gray-400">
        Contacts or organizations with prior outreach, Gmail threads, or synced Calendar meetings are skipped automatically. Chapters, state associations, unverified emails, and undated large opportunities stay off this line.
      </p>
      <Link href="/admin/sales/autosend" className="csc-link text-sm">
        Open the live draft queue →
      </Link>
    </SettingsPanel>
  );
}
