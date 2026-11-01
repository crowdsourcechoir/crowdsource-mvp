"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
} from "@/components/settings/ui";
import { dedupeMailchimpRows, inspectMailchimpCsv, type MailchimpCsvSummary } from "@/lib/marketing/ingest/mailchimp-csv";
import type { MarketingPerson } from "@/lib/marketing/types";

const IMPORT_BATCH = 25;
const MATCH_BATCH = 500;

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
  const [summary, setSummary] = useState<MailchimpCsvSummary | null>(null);
  const [existing, setExisting] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
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
      setMessage(
        data.skippedReason
          ? String(data.skippedReason)
          : data.created
            ? "Added subscriber"
            : "Updated existing person"
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function stageCsv(text: string) {
    setCsv(text);
    setMessage(null);
    setError(null);
    setProgress(null);
    const inspected = inspectMailchimpCsv(text);
    setSummary(inspected.summary);
    setExisting(null);
    if (!inspected.summary.parsed) return;
    const rows = dedupeMailchimpRows(inspected.rows);
    setBusy(true);
    try {
      let found = 0;
      for (let index = 0; index < rows.length; index += MATCH_BATCH) {
        const emails = rows.slice(index, index + MATCH_BATCH).map((row) => row.email);
        const res = await fetch("/api/marketing/audience/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true, emails }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not compare with Octo");
        found += Number(data.existing ?? 0);
      }
      setExisting(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compare with Octo");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    const rows = dedupeMailchimpRows(inspectMailchimpCsv(csv).rows);
    if (!rows.length) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    try {
      for (let index = 0; index < rows.length; index += IMPORT_BATCH) {
        const batch = rows.slice(index, index + IMPORT_BATCH);
        setProgress(`Importing ${Math.min(index + batch.length, rows.length)} of ${rows.length}`);
        const res = await fetch("/api/marketing/audience/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        created += Number(data.created ?? 0);
        updated += Number(data.updated ?? 0);
        skipped += Number(data.skipped ?? 0);
      }
      setMessage(`Import: ${created} created, ${updated} updated, ${skipped} skipped`);
      setCsv("");
      setSummary(null);
      setExisting(null);
      setProgress(null);
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
        description="Marketing audience only. Unsubscribed and cleaned imports stay suppressed. New people can join at /subscribe. Garden email capture is not auto-subscribed."
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
        description="Choose the audience export. The check counts subscribed, unsubscribed, cleaned, and duplicates before anything is written. Tags, interests, state, country, and confirm time are kept. Imports run in small batches."
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="block text-sm text-gray-300 file:mr-3 file:rounded-full file:border file:border-[var(--csc-row-divider)] file:bg-transparent file:px-3 file:py-1 file:text-xs file:font-semibold file:uppercase file:tracking-[0.14em] file:text-white"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then((text) => stageCsv(text)).catch(() => setError("Could not read that file"));
          }}
        />
        <textarea
          value={csv}
          onChange={(event) => {
            const text = event.target.value;
            setCsv(text);
            setSummary(null);
            setExisting(null);
          }}
          rows={5}
          className="mt-3 w-full rounded-lg border border-[var(--csc-row-divider)] bg-black px-3 py-2 text-sm text-white"
          placeholder={"Email Address,First Name,Last Name,Status,Tags,State,Country\nperson@example.com,Ada,Lovelace,subscribed,newsletter,WA,USA"}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <SettingsButton disabled={busy || !csv.trim()} onClick={() => stageCsv(csv)}>
            Check file
          </SettingsButton>
          <SettingsButton variant="primary" disabled={busy || !summary?.parsed} onClick={importCsv}>
            Import
          </SettingsButton>
        </div>
        {summary ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone="neutral">{summary.parsed} people</StatusPill>
            <StatusPill tone="ok">{summary.subscribed} subscribed</StatusPill>
            <StatusPill tone="off">{summary.unsubscribed} unsubscribed</StatusPill>
            <StatusPill tone="neutral">{summary.cleaned} cleaned</StatusPill>
            <StatusPill tone="neutral">{summary.pending} pending</StatusPill>
            <StatusPill tone="neutral">{summary.duplicateEmails} duplicates dropped</StatusPill>
            <StatusPill tone="neutral">{summary.missingEmail} missing email</StatusPill>
            {existing !== null ? <StatusPill tone="neutral">{existing} already in Octo</StatusPill> : null}
          </div>
        ) : null}
        {progress ? <p className="mt-3 text-sm text-gray-300">{progress}</p> : null}
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
                    <Link href={`/admin/marketing/audience/${p.id}`} className="csc-link text-white">
                      {p.displayName || p.email}
                    </Link>
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
