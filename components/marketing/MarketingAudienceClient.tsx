"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
} from "@/components/settings/ui";
import type { MarketingPerson } from "@/lib/marketing/types";

export default function MarketingAudienceClient() {
  const [people, setPeople] = useState<MarketingPerson[]>([]);
  const [totals, setTotals] = useState<{ all: number; subscribed: number; unsubscribed: number; cleaned: number } | null>(
    null
  );
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketing/audience?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load audience");
    setPeople(data.people ?? []);
    setTotals(data.totals ?? null);
  }, [q]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function addPerson() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, city, marketingConsent: true, status: "subscribed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed");
      setEmail("");
      setDisplayName("");
      setCity("");
      setMessage(data.created ? "Added subscriber" : "Updated existing person");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/audience/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setMessage(`Import: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`);
      setCsv("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Audience"
        title="People"
        description="Marketing audience only. Unsubscribed/cleaned imports stay suppressed. Garden email capture is not auto-subscribed."
        actions={
          <>
            <StatusPill tone="ok">{totals?.subscribed ?? 0} subscribed</StatusPill>
            <StatusPill tone="off">{totals?.unsubscribed ?? 0} unsub</StatusPill>
            <StatusPill tone="neutral">{totals?.cleaned ?? 0} cleaned</StatusPill>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <TextField value={q} onChange={setQ} placeholder="Search email, name, city, tag" />
          <SettingsButton onClick={() => load()} disabled={busy}>
            Refresh
          </SettingsButton>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Add person">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextField value={email} onChange={setEmail} placeholder="name@example.com" />
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextField value={displayName} onChange={setDisplayName} placeholder="Optional" />
          </div>
          <div>
            <FieldLabel>City</FieldLabel>
            <TextField value={city} onChange={setCity} placeholder="Seattle" />
          </div>
        </div>
        <div className="mt-3">
          <SettingsButton variant="primary" onClick={addPerson} disabled={busy || !email.trim()}>
            Add subscribed
          </SettingsButton>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Mailchimp CSV import"
        description="Header must include Email. Status / Tags / City columns are optional. Unsubscribed rows stay unsubscribed."
      >
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-[var(--csc-row-divider)] bg-black px-3 py-2 text-sm text-white"
          placeholder={"Email,First Name,Last Name,Status,Tags,City\nperson@example.com,Ada,Lovelace,subscribed,newsletter,Seattle"}
        />
        <div className="mt-3">
          <SettingsButton variant="primary" onClick={importCsv} disabled={busy || !csv.trim()}>
            Import CSV
          </SettingsButton>
        </div>
      </SettingsPanel>

      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-[var(--csc-row-divider)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.14em] text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--csc-row-divider)]">
            {people.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-gray-500">
                  No people yet.
                </td>
              </tr>
            ) : (
              people.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="text-white">{p.displayName || p.email}</div>
                    {p.displayName ? <div className="text-xs text-gray-500">{p.email}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{p.city || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      tone={
                        p.status === "subscribed" ? "ok" : p.status === "unsubscribed" ? "off" : "neutral"
                      }
                    >
                      {p.status}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.acquisitionSource}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
