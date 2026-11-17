"use client";

import { useEffect, useState } from "react";
import CscDatePicker from "@/components/ui/CscDatePicker";
import {
  formatFollowUpDay,
  ymdInSalesZone,
  type FollowUpPreset,
} from "@/lib/sales/follow-up/calendar";
import { readParkedFollowUp, type ParkedFollowUpRecord } from "@/lib/sales/follow-up/parked";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";
import type { RelationshipStage } from "@/lib/sales/types";

const PRESETS: { key: FollowUpPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "in_3_days", label: "In 3 days" },
  { key: "next_week", label: "Next week" },
];

export type ParkedFollowUpUpdate = {
  nextFollowUpAt: string | null;
  relationshipStage: RelationshipStage | null;
  importMetadata: Record<string, unknown> | null;
  parked: boolean;
};

export default function FollowUpControls({
  opportunityId,
  nextFollowUpAt,
  importMetadata,
  onSaved,
  onParked,
}: {
  opportunityId: string;
  nextFollowUpAt: string | null;
  importMetadata?: Record<string, unknown> | null;
  onSaved?: (nextFollowUpAt: string | null) => void;
  onParked?: (update: ParkedFollowUpUpdate) => void;
}) {
  const [value, setValue] = useState(nextFollowUpAt);
  const [custom, setCustom] = useState(ymdInSalesZone(nextFollowUpAt));
  const [parked, setParked] = useState<ParkedFollowUpRecord | null>(readParkedFollowUp(importMetadata));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarNote, setCalendarNote] = useState<string | null>(null);
  const [calendarLink, setCalendarLink] = useState<string | null>(null);

  useEffect(() => {
    setValue(nextFollowUpAt);
    setCustom(ymdInSalesZone(nextFollowUpAt));
    setParked(readParkedFollowUp(importMetadata));
    setCalendarLink(null);
    setCalendarNote(null);
    setError(null);
  }, [opportunityId, nextFollowUpAt, importMetadata]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setCalendarNote(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not set follow-up"));
      const payload = data as {
        nextFollowUpAt?: string | null;
        calendarWarning?: string | null;
        opportunity?: {
          relationshipStage?: RelationshipStage | null;
          importMetadata?: Record<string, unknown> | null;
        };
      };
      const next = (payload.nextFollowUpAt ?? null) as string | null;
      setValue(next);
      setCustom(ymdInSalesZone(next));
      setCalendarNote(payload.calendarWarning ?? null);
      const nextMeta = payload.opportunity?.importMetadata;
      if (nextMeta !== undefined) {
        const nextParked = readParkedFollowUp(nextMeta);
        setParked(nextParked);
        onParked?.({
          nextFollowUpAt: next,
          relationshipStage: payload.opportunity?.relationshipStage ?? null,
          importMetadata: nextMeta,
          parked: Boolean(nextParked),
        });
      }
      onSaved?.(next);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not set follow-up"));
    } finally {
      setBusy(false);
    }
  }

  async function park() {
    if (!custom) {
      setError("Pick a date first.");
      return;
    }
    setBusy(true);
    setError(null);
    setCalendarNote(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/parked-follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: custom }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not park follow-up"));
      const payload = data as {
        nextFollowUpAt?: string | null;
        subject?: string;
        body?: string;
        editionLabel?: string;
        relationshipStage?: RelationshipStage | null;
        opportunity?: { importMetadata?: Record<string, unknown> | null; relationshipStage?: RelationshipStage | null };
        calendar?: { htmlLink?: string | null; summary?: string; warning?: string | null };
      };
      const next = payload.nextFollowUpAt ?? null;
      const meta = payload.opportunity?.importMetadata ?? null;
      const record = readParkedFollowUp(meta);
      setValue(next);
      setCustom(ymdInSalesZone(next));
      setParked(record);
      setCalendarLink(payload.calendar?.htmlLink ?? null);
      setCalendarNote(
        payload.calendar?.warning ??
          `Parked. ${payload.calendar?.summary ?? "Check-in"} is a one-minute hold at 9:00am Pacific. Nothing was emailed.`
      );
      onParked?.({
        nextFollowUpAt: next,
        relationshipStage: payload.opportunity?.relationshipStage ?? payload.relationshipStage ?? "parked",
        importMetadata: meta,
        parked: true,
      });
      onSaved?.(next);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not park follow-up"));
    } finally {
      setBusy(false);
    }
  }

  async function queueDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${opportunityId}/parked-follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: true }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not queue the draft"));
      const href = (data as { href?: string }).href;
      if (href) window.location.assign(href);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not queue the draft"));
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-white/10 bg-[var(--csc-shell-bg,#000)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="csc-eyebrow">Follow up</p>
        <p className="text-sm text-white">
          {parked ? `Parked · ${formatFollowUpDay(value)}` : value ? formatFollowUpDay(value) : "Not set"}
        </p>
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
        <button
          type="button"
          disabled={busy || !custom}
          onClick={() => void park()}
          className="rounded-full border border-[var(--csc-accent)] bg-[var(--csc-accent)] px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Working…" : parked ? "Update reminder" : "Park & remind"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>Custom</span>
        <CscDatePicker
          value={custom}
          disabled={busy}
          onChange={(ymd) => {
            setCustom(ymd);
            if (ymd) void save({ date: ymd });
          }}
          onClear={() => {
            setCustom("");
            if (value) void save({ clear: true });
          }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Park &amp; remind drafts the check-in, puts a one-minute hold on your calendar, and moves the deal to Parked.
        It does not send email.
      </p>
      {parked ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-white">{parked.subject}</p>
          {parked.contactName || parked.contactEmail ? (
            <p className="mt-1 text-xs text-gray-400">
              {[parked.contactName, parked.contactEmail].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-300">
            {parked.body}
          </pre>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void queueDraft()}
              className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-200 hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
            >
              Queue to send
            </button>
            {calendarLink ? (
              <a href={calendarLink} target="_blank" rel="noreferrer" className="csc-link px-2.5 py-1 text-xs">
                Open calendar event
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {calendarNote ? <p className="mt-2 text-xs text-[var(--csc-accent)]">{calendarNote}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
