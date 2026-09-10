"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsButton, SettingsPanel, Stat, StatGrid, StatusPill } from "@/components/settings/ui";

type Totals = {
  people: number;
  subscribed: number;
  campaigns: number;
  emailsSent: number;
};

export default function MarketingOverviewClient() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [sendsEnabled, setSendsEnabled] = useState(false);
  const [resendConfigured, setResendConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/settings", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setTotals(data.totals);
        setSendsEnabled(Boolean(data.settings?.sendsEnabled));
        setResendConfigured(Boolean(data.resendConfigured));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <SettingsPanel
        eyebrow="Overview"
        title="Marketing"
        description="Audience, segments, and branded email campaigns — separate from Sales outreach and without changing live Gardens or Blooms."
        actions={
          <>
            <StatusPill tone={sendsEnabled ? "ok" : "off"}>{sendsEnabled ? "Sends on" : "Sends paused"}</StatusPill>
            <StatusPill tone={resendConfigured ? "ok" : "warn"}>
              {resendConfigured ? "Resend ready" : "Resend missing"}
            </StatusPill>
            <SettingsButton href="/admin/settings/marketing">Settings</SettingsButton>
          </>
        }
      >
        <StatGrid>
          <Stat label="Audience" value={totals?.people ?? "—"} />
          <Stat label="Subscribed" value={totals?.subscribed ?? "—"} />
          <Stat label="Campaigns" value={totals?.campaigns ?? "—"} />
          <Stat label="Emails sent" value={totals?.emailsSent ?? "—"} />
        </StatGrid>
      </SettingsPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/admin/marketing/audience", title: "Audience", blurb: "People, consent, import" },
          { href: "/admin/marketing/segments", title: "Segments", blurb: "City, tags, consent rules" },
          { href: "/admin/marketing/campaigns", title: "Campaigns", blurb: "Compose and send email" },
          { href: "/admin/marketing/analytics", title: "Analytics", blurb: "Send results" },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-[var(--csc-row-divider)] px-4 py-5 transition-[border-color] hover:border-[var(--csc-accent)]"
          >
            <p className="csc-eyebrow">Open</p>
            <h2 className="mt-2 text-base font-semibold text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-400">{card.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
