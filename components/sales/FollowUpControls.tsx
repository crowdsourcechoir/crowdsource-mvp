"use client";

import { useEffect, useState } from "react";
import {
  formatFollowUpDay,
  ymdInSalesZone,
  type FollowUpPreset,
} from "@/lib/sales/follow-up/calendar";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

const PRESETS: { key: FollowUpPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "in_3_days", label: "In 3 days" },
  { key: "next_week", label: "Next week" },
];

export default function FollowUpControls({
  opportunityId,
  nextFollowUpAt,
  onSaved,
}: {
  opportunityId: string;
  nextFollowUpAt: string | null;
  onSaved?: (nextFollowUpAt: string | null) => void;
}) {
  const [value, setValue] = useState(nextFollowUpAt);
  const [custom, setCustom] = useState(ymdInSalesZone(nextFollowUpAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(nextFollowUpAt);
    setCustom(ymdInSalesZone(nextFollowUpAt));
  }, [opportunityId, nextFollowUpAt]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not set follow-up"));
      const next = ((data as { nextFollowUpAt?: string | null }).nextFollowUpAt ?? null) as string | null;
      setValue(next);
      setCustom(ymdInSalesZone(next));
      onSaved?.(next);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not set follow-up"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow up</p>
        <p className="text-sm text-white">{value ? formatFollowUpDay(value) : "Not set"}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            disabled={busy}
            onClick={() => void save({ preset: preset.key })}
            className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || !value}
          onClick={() => void save({ clear: true })}
          className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-500 hover:border-white/20 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        Custom
        <input
          type="date"
          value={custom}
          disabled={busy}
          onChange={(e) => {
            setCustom(e.target.value);
            if (e.target.value) void save({ date: e.target.value });
          }}
          className="rounded-lg border border-white/15 bg-black px-2 py-1 text-xs text-white accent-[var(--csc-accent)] [color-scheme:dark] focus:border-[var(--csc-accent)] focus:outline-none disabled:opacity-50"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
