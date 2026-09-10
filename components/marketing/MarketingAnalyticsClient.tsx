"use client";

import { useEffect, useState } from "react";
import { SettingsPanel, Stat, StatGrid, StatusPill } from "@/components/settings/ui";
import type { MarketingEmail } from "@/lib/marketing/types";

export default function MarketingAnalyticsClient() {
  const [emails, setEmails] = useState<MarketingEmail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/campaigns", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setEmails((data.emails ?? []).filter((e: MarketingEmail) => e.status === "sent"));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const totals = emails.reduce(
    (acc, e) => ({
      sent: acc.sent + e.stats.sent,
      delivered: acc.delivered + e.stats.delivered,
      bounced: acc.bounced + e.stats.bounced,
      opened: acc.opened + e.stats.opened,
      clicked: acc.clicked + e.stats.clicked,
      unsubscribed: acc.unsubscribed + e.stats.unsubscribed,
    }),
    { sent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0, unsubscribed: 0 }
  );

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Analytics"
        title="Send results"
        description="Delivery stats from Resend webhooks. Journey attribution (click → garden → contribute) comes in a later phase."
      >
        <StatGrid>
          <Stat label="Sent" value={totals.sent} />
          <Stat label="Delivered" value={totals.delivered} />
          <Stat label="Bounced" value={totals.bounced} />
          <Stat label="Opened" value={totals.opened} hint="Best-effort / privacy-limited" />
          <Stat label="Clicked" value={totals.clicked} />
          <Stat label="Unsubscribed" value={totals.unsubscribed} />
        </StatGrid>
      </SettingsPanel>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {emails.length === 0 ? (
          <p className="text-sm text-gray-500">No sent emails yet.</p>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className="rounded-xl border border-[var(--csc-row-divider)] px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">{email.subject || "(no subject)"}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <StatusPill tone="ok">sent</StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone="neutral">Sent {email.stats.sent}</StatusPill>
                <StatusPill tone="neutral">Delivered {email.stats.delivered}</StatusPill>
                <StatusPill tone="off">Bounced {email.stats.bounced}</StatusPill>
                <StatusPill tone="neutral">Opened {email.stats.opened}</StatusPill>
                <StatusPill tone="neutral">Clicked {email.stats.clicked}</StatusPill>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
