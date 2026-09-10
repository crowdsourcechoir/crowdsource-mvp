"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  SettingsButton,
  SettingsPanel,
  StatusPill,
  TextField,
} from "@/components/settings/ui";
import type { MarketingSegment, SegmentRule, SegmentRuleField } from "@/lib/marketing/types";

type SegmentRow = MarketingSegment & { counts: { matched: number; sendable: number } };

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
