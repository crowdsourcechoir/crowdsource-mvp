"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsButton, SettingsPanel, StatusPill } from "@/components/settings/ui";
import type { MarketingCampaign, MarketingEmail } from "@/lib/marketing/types";

async function parseJson(res: Response): Promise<{
  error?: string;
  campaigns?: MarketingCampaign[];
  emails?: MarketingEmail[];
  campaign?: MarketingCampaign;
}> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: res.ok ? undefined : `Request failed (${res.status})` };
  }
  try {
    return JSON.parse(text) as {
      error?: string;
      campaigns?: MarketingCampaign[];
      emails?: MarketingEmail[];
      campaign?: MarketingCampaign;
    };
  } catch {
    return { error: `Invalid response (${res.status})` };
  }
}

export default function MarketingCampaignsClient() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [emails, setEmails] = useState<MarketingEmail[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/marketing/campaigns", { cache: "no-store" });
    const data = await parseJson(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to load campaigns");
    setCampaigns(data.campaigns ?? []);
    setEmails(data.emails ?? []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function createCampaign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Weekly newsletter" }),
      });
      const data = await parseJson(res);
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setName("");
      await load();
      if (data.campaign?.id) window.location.href = `/admin/marketing/campaigns/${data.campaign.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Campaigns"
        title="Email campaigns"
        description="Create a campaign, compose with constrained blocks, preview, test, then send to a segment."
      >
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="min-w-[16rem] flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
          />
          <SettingsButton variant="primary" disabled={busy} onClick={createCampaign}>
            New campaign
          </SettingsButton>
        </div>
      </SettingsPanel>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">No campaigns yet.</p>
        ) : (
          campaigns.map((campaign) => {
            const email = emails.find((e) => e.campaignId === campaign.id);
            return (
              <Link
                key={campaign.id}
                href={`/admin/marketing/campaigns/${campaign.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--csc-row-divider)] px-4 py-4 transition-[border-color] hover:border-[var(--csc-accent)]"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white">{campaign.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">{email?.subject || "No subject yet"}</p>
                </div>
                <div className="flex gap-2">
                  <StatusPill tone="neutral">{campaign.status}</StatusPill>
                  {email ? <StatusPill tone={email.status === "sent" ? "ok" : "neutral"}>{email.status}</StatusPill> : null}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
