"use client";

import { useEffect, useState } from "react";
import {
  FieldLabel,
  InlineNote,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
  ToggleRow,
} from "@/components/settings/ui";
import type { MarketingSettings } from "@/lib/marketing/types";

export default function MarketingSettingsClient() {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [resendConfigured, setResendConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing/settings", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setSettings(data.settings);
        setResendConfigured(Boolean(data.resendConfigured));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSettings(data.settings);
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-gray-400">{error || "Loading…"}</p>;
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Integrations"
        title="Marketing delivery"
        description="Resend delivers mail. Octo owns audience, consent, segments, and campaigns. Bulk sends stay paused until you enable them."
        actions={
          <>
            <StatusPill tone={resendConfigured ? "ok" : "warn"}>
              {resendConfigured ? "RESEND_API_KEY set" : "RESEND_API_KEY missing"}
            </StatusPill>
            <StatusPill tone={settings.sendsEnabled ? "ok" : "off"}>
              {settings.sendsEnabled ? "Sends enabled" : "Sends paused"}
            </StatusPill>
          </>
        }
      >
        <ToggleRow
          label="Enable marketing sends"
          hint="Required before Send now. Test sends still need Resend + from address."
          checked={settings.sendsEnabled}
          onChange={(sendsEnabled) => setSettings({ ...settings, sendsEnabled })}
        />
      </SettingsPanel>

      <SettingsPanel title="From identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>From name</FieldLabel>
            <TextField
              value={settings.fromName}
              onChange={(fromName) => setSettings({ ...settings, fromName })}
            />
          </div>
          <div>
            <FieldLabel hint="Must be on a verified Resend domain">From email</FieldLabel>
            <TextField
              value={settings.fromEmail}
              onChange={(fromEmail) => setSettings({ ...settings, fromEmail })}
              placeholder="hello@crowdsourcechoir.com"
            />
          </div>
          <div>
            <FieldLabel>Reply-to</FieldLabel>
            <TextField
              value={settings.replyTo ?? ""}
              onChange={(replyTo) => setSettings({ ...settings, replyTo: replyTo || null })}
            />
          </div>
          <div>
            <FieldLabel>Company name</FieldLabel>
            <TextField
              value={settings.companyName}
              onChange={(companyName) => setSettings({ ...settings, companyName })}
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel hint="Shown in email footer">Physical address</FieldLabel>
            <TextField
              value={settings.physicalAddress}
              onChange={(physicalAddress) => setSettings({ ...settings, physicalAddress })}
            />
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Acquisition ingest"
        description="Squarespace and Facebook Lead Ads POST here with this shared secret."
      >
        <FieldLabel>Ingest secret</FieldLabel>
        <TextField
          value={settings.ingestSecret ?? ""}
          onChange={(ingestSecret) => setSettings({ ...settings, ingestSecret: ingestSecret || null })}
          placeholder="long random string"
        />
        <InlineNote>
          Endpoints: POST /api/marketing/ingest/squarespace and /api/marketing/ingest/facebook with header
          x-marketing-ingest-secret.
        </InlineNote>
        <InlineNote>
          Resend webhook: POST /api/marketing/webhooks/resend
        </InlineNote>
      </SettingsPanel>

      <SettingsButton variant="primary" disabled={busy} onClick={save}>
        Save settings
      </SettingsButton>
      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
