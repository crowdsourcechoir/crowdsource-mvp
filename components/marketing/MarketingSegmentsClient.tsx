"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
} from "@/components/settings/ui";
import { parseEmailList } from "@/lib/marketing/ingest/email-list";
import type { MarketingSegment, SegmentRule, SegmentRuleField } from "@/lib/marketing/types";

type SegmentRow = MarketingSegment & { counts: { matched: number; sendable: number } };

type ListStats = { unique: number; duplicateRows: number; existing: number };

const FIELDS: { value: SegmentRuleField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "marketingConsent", label: "Marketing consent" },
  { value: "city", label: "City" },
  { value: "tag", label: "Tag" },
  { value: "acquisitionSource", label: "Source" },
];

export default function MarketingSegmentsClient() {
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Seattle");
  const [tag, setTag] = useState("");
  const [listCity, setListCity] = useState("Spokane");
  const [listEmails, setListEmails] = useState<string[]>([]);
  const [listStats, setListStats] = useState<ListStats | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/marketing/segments", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load segments");
    setSegments(data.segments ?? []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function createSegment(rules: SegmentRule[], label: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: label, rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkList(text: string) {
    const parsed = parseEmailList(text);
    setListEmails(parsed.emails);
    setListMessage(null);
    setError(null);
    if (!parsed.emails.length) {
      setListStats(null);
      setError("No email addresses in that file.");
      return;
    }
    setBusy(true);
    try {
      let existing = 0;
      for (let index = 0; index < parsed.emails.length; index += 400) {
        const res = await fetch("/api/marketing/segments/city-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: true,
            city: listCity.trim() || "Spokane",
            emails: parsed.emails.slice(index, index + 400),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not compare that list");
        existing += Number(data.existing ?? 0);
      }
      setListStats({ unique: parsed.emails.length, duplicateRows: parsed.duplicateRows, existing });
    } catch (err) {
      setListStats(null);
      setError(err instanceof Error ? err.message : "Could not compare that list");
    } finally {
      setBusy(false);
    }
  }

  async function saveList() {
    const cityName = listCity.trim();
    if (!cityName || !listEmails.length) return;
    setBusy(true);
    setError(null);
    let matched = 0;
    let created = 0;
    let skipped = 0;
    try {
      for (let index = 0; index < listEmails.length; index += 25) {
        setListMessage(`Saving ${Math.min(index + 25, listEmails.length).toLocaleString()} of ${listEmails.length.toLocaleString()}`);
        const res = await fetch("/api/marketing/segments/city-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: cityName, emails: listEmails.slice(index, index + 25) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        matched += Number(data.matched ?? 0);
        created += Number(data.created ?? 0);
        skipped += Number(data.skipped ?? 0);
      }
      const duplicates = listStats?.duplicateRows ? `, ${listStats.duplicateRows.toLocaleString()} duplicate rows ignored` : "";
      const skippedNote = skipped ? `, ${skipped.toLocaleString()} left off because they are suppressed` : "";
      setListMessage(
        `${cityName}: ${matched.toLocaleString()} already in the audience, ${created.toLocaleString()} added${duplicates}${skippedNote}. Segment saved.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeSegment(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/marketing/segments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="City list"
        title="Upload a segment export"
        description="In Mailchimp, export the Spokane audience as a CSV. People already here are matched by email and not added twice."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <FieldLabel>City</FieldLabel>
            <TextField value={listCity} onChange={setListCity} placeholder="Spokane" />
          </div>
          <SettingsButton variant="primary" disabled={busy || !listStats || !listCity.trim()} onClick={saveList}>
            Save segment
          </SettingsButton>
        </div>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="mt-3 block text-sm text-gray-300 file:mr-3 file:rounded-full file:border file:border-[var(--csc-row-divider)] file:bg-transparent file:px-3 file:py-1 file:text-xs file:font-semibold file:uppercase file:tracking-[0.14em] file:text-white"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then((text) => checkList(text)).catch(() => setError("Could not read that file"));
          }}
        />
        {listStats ? (
          <p className="mt-3 text-sm text-gray-300">
            {listStats.unique.toLocaleString()} unique emails. {listStats.duplicateRows.toLocaleString()} duplicates in the file.{" "}
            {listStats.existing.toLocaleString()} already in the audience.{" "}
            {(listStats.unique - listStats.existing).toLocaleString()} not here yet.
          </p>
        ) : null}
        {listMessage ? <p className="mt-2 text-sm text-gray-300">{listMessage}</p> : null}
      </SettingsPanel>

      <SettingsPanel
        eyebrow="Segments"
        title="Targeting"
        description="v1 rules are AND-combined. Sends only go to subscribed + consenting people who match."
      >
        <div className="flex flex-wrap gap-2">
          <SettingsButton
            variant="primary"
            disabled={busy}
            onClick={() =>
              createSegment(
                [
                  { field: "status", op: "eq", value: "subscribed" },
                  { field: "marketingConsent", op: "eq", value: true },
                ],
                name.trim() || "All subscribers"
              )
            }
          >
            Create all subscribers
          </SettingsButton>
          <div className="flex min-w-[14rem] flex-1 items-end gap-2">
            <div className="flex-1">
              <FieldLabel>City segment</FieldLabel>
              <TextField value={city} onChange={setCity} placeholder="Seattle" />
            </div>
            <SettingsButton
              disabled={busy || !city.trim()}
              onClick={() =>
                createSegment(
                  [
                    { field: "status", op: "eq", value: "subscribed" },
                    { field: "marketingConsent", op: "eq", value: true },
                    { field: "city", op: "eq", value: city.trim() },
                  ],
                  name.trim() || `${city.trim()} subscribers`
                )
              }
            >
              Create city segment
            </SettingsButton>
          </div>
        </div>
        <div className="mt-3 flex min-w-[14rem] flex-1 items-end gap-2">
          <div className="flex-1">
            <FieldLabel hint="Use a Mailchimp tag or a group: tag from import">Tag segment</FieldLabel>
            <TextField value={tag} onChange={setTag} placeholder="newsletter" />
          </div>
          <SettingsButton
            disabled={busy || !tag.trim()}
            onClick={() =>
              createSegment(
                [
                  { field: "status", op: "eq", value: "subscribed" },
                  { field: "marketingConsent", op: "eq", value: true },
                  { field: "tag", op: "eq", value: tag.trim() },
                ],
                name.trim() || `${tag.trim()} subscribers`
              )
            }
          >
            Create tag segment
          </SettingsButton>
        </div>
        <div className="mt-3 max-w-md">
          <FieldLabel hint="Optional custom name for the next create action">Name override</FieldLabel>
          <TextField value={name} onChange={setName} placeholder="Weekly Seattle list" />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Fields available: {FIELDS.map((f) => f.label).join(", ")}.
        </p>
      </SettingsPanel>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {segments.length === 0 ? (
          <p className="text-sm text-gray-500">No segments yet.</p>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--csc-row-divider)] px-4 py-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-white">{segment.name}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {segment.rules.map((r) => `${r.field} ${r.op} ${String(r.value)}`).join(" AND ")}
                </p>
                <div className="mt-2 flex gap-2">
                  <StatusPill tone="neutral">{segment.counts.matched} matched</StatusPill>
                  <StatusPill tone="ok">{segment.counts.sendable} sendable</StatusPill>
                </div>
              </div>
              <SettingsButton variant="danger" disabled={busy} onClick={() => removeSegment(segment.id)}>
                Delete
              </SettingsButton>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
