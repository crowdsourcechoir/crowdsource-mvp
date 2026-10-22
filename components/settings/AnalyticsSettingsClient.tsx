"use client";

import { useEffect, useState } from "react";
import { SEGMENTS, type AnalyticsReport, type SegmentId } from "@/lib/analytics/model";
import { InlineNote, SettingsButton, TextField, ToggleRow } from "@/components/settings/ui";

type ReportResponse = AnalyticsReport & { storageError?: string | null; error?: string };

const RANGES = [7, 30, 90] as const;

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${rest}s`;
}

function formatDevice(device: string): string {
  if (device === "mobile") return "Mobile";
  if (device === "tablet") return "Tablet";
  return "Desktop";
}

function RankList({
  ready,
  rows,
}: {
  ready: boolean;
  rows: { key: string; primary: string; secondary: string }[];
}) {
  if (!ready) return <p className="text-sm text-white/50">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-white/50">Nothing in this range yet.</p>;
  return (
    <div className="csc-list">
      {rows.map((row) => (
        <div key={row.key} className="csc-list-row">
          <span className="min-w-0 flex-1 truncate text-sm text-white">{row.primary}</span>
          <span className="shrink-0 text-sm text-white/60">{row.secondary}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsSettingsClient() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [segment, setSegment] = useState<SegmentId | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [gaId, setGaId] = useState("");
  const [gaStatus, setGaStatus] = useState<string | null>(null);
  const [savingGa, setSavingGa] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days), internal: includeInternal ? "1" : "0" });
    if (segment) params.set("segment", segment);
    const controller = new AbortController();
    fetch(`/api/analytics/report?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as ReportResponse;
        if (!res.ok) throw new Error(data.error ?? "Could not load analytics");
        setReport(data);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setReport({ error: err instanceof Error ? err.message : "Could not load analytics" } as ReportResponse);
      });
    return () => controller.abort();
  }, [days, includeInternal, segment]);

  useEffect(() => {
    fetch("/api/analytics/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { gaMeasurementId?: string | null }) => setGaId(data.gaMeasurementId ?? ""))
      .catch(() => undefined);
  }, []);

  const ready = report !== null;
  const totals = report?.totals;
  const maxDay = Math.max(1, ...(report?.daily ?? []).map((day) => day.views));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((range) => (
          <SettingsButton key={range} variant={days === range ? "primary" : "ghost"} onClick={() => setDays(range)}>
            {range} days
          </SettingsButton>
        ))}
      </div>

      <ToggleRow
        label="Include signed-in visits"
        hint="Your own admin browsing stays out of the public counts until this is on."
        checked={includeInternal}
        onChange={setIncludeInternal}
      />

      {report?.storageError ? <InlineNote tone="warn">{report.storageError}</InlineNote> : null}
      {report?.error ? <InlineNote tone="off">{report.error}</InlineNote> : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
        {[
          ["Visitors", totals ? totals.visitors.toLocaleString() : "–"],
          ["Sessions", totals ? totals.sessions.toLocaleString() : "–"],
          ["Page views", totals ? totals.pageViews.toLocaleString() : "–"],
          ["Time on page", totals ? formatDuration(totals.avgEngagementSec) : "–"],
          ["Engaged sessions", totals ? `${totals.engagedRate}%` : "–"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="csc-eyebrow">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="csc-eyebrow">By day</p>
        <div className="mt-3 flex items-end gap-1">
          {(report?.daily ?? []).map((day) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${day.date}: ${day.views} views`}>
              <div className="flex h-16 w-full items-end">
                <div
                  className="w-full bg-[var(--csc-accent)]"
                  style={{ height: day.views ? `${Math.max(8, Math.round((day.views / maxDay) * 100))}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="csc-eyebrow">Segment</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SettingsButton variant={segment === null ? "primary" : "ghost"} onClick={() => setSegment(null)}>
            All
          </SettingsButton>
          {SEGMENTS.map((item) => {
            const count = report?.segments.find((row) => row.id === item.id)?.views ?? 0;
            return (
              <SettingsButton key={item.id} variant={segment === item.id ? "primary" : "ghost"} onClick={() => setSegment(item.id)}>
                {item.label}
                {count ? ` ${count}` : ""}
              </SettingsButton>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <p className="csc-eyebrow">Countries</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.countries ?? []).map((row) => ({
                key: row.code,
                primary: row.name,
                secondary: `${row.visitors.toLocaleString()} visitors`,
              }))}
            />
          </div>
        </section>
        <section>
          <p className="csc-eyebrow">Cities</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.cities ?? []).map((row) => ({
                key: row.label,
                primary: row.label,
                secondary: `${row.visitors.toLocaleString()} visitors`,
              }))}
            />
          </div>
        </section>
        <section>
          <p className="csc-eyebrow">Song Garden, Bloom, and the rest</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.entities ?? []).map((row) => ({
                key: `${row.segment}:${row.entity}`,
                primary: `${row.segmentLabel} · ${row.entity}`,
                secondary: `${row.views.toLocaleString()} views · ${formatDuration(row.avgEngagementSec)}`,
              }))}
            />
          </div>
        </section>
        <section>
          <p className="csc-eyebrow">Pages</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.pages ?? []).map((row) => ({
                key: row.path,
                primary: row.path,
                secondary: `${row.views.toLocaleString()} views · ${formatDuration(row.avgEngagementSec)}`,
              }))}
            />
          </div>
        </section>
        <section>
          <p className="csc-eyebrow">Referring sites</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.referrers ?? []).map((row) => ({
                key: row.host,
                primary: row.host,
                secondary: `${row.views.toLocaleString()} views`,
              }))}
            />
          </div>
        </section>
        <section>
          <p className="csc-eyebrow">Devices</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.devices ?? []).map((row) => ({
                key: row.device,
                primary: formatDevice(row.device),
                secondary: `${row.visitors.toLocaleString()} visitors`,
              }))}
            />
          </div>
        </section>
      </div>

      {(report?.hosts?.length ?? 0) > 1 ? (
        <section>
          <p className="csc-eyebrow">Sites</p>
          <div className="mt-3">
            <RankList
              ready={ready}
              rows={(report?.hosts ?? []).map((row) => ({
                key: row.host,
                primary: row.host,
                secondary: `${row.visitors.toLocaleString()} visitors`,
              }))}
            />
          </div>
        </section>
      ) : null}

      <form
        className="max-w-md space-y-3 border-t border-[var(--csc-row-divider)] pt-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setSavingGa(true);
          setGaStatus(null);
          try {
            const res = await fetch("/api/analytics/config", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gaMeasurementId: gaId }),
            });
            const data = (await res.json()) as { error?: string; gaMeasurementId?: string | null };
            if (!res.ok) throw new Error(data.error ?? "Could not save Google Analytics");
            setGaId(data.gaMeasurementId ?? "");
            setGaStatus(data.gaMeasurementId ? "Google Analytics is receiving page views." : "Google Analytics is off.");
          } catch (err) {
            setGaStatus(err instanceof Error ? err.message : "Could not save Google Analytics");
          } finally {
            setSavingGa(false);
          }
        }}
      >
        <p className="csc-eyebrow">Google Analytics</p>
        <p className="text-sm text-white/60">
          Paste a GA4 measurement id to also send page views to Google. The reports on this page stay here either way.
        </p>
        <TextField value={gaId} onChange={setGaId} placeholder="G-XXXXXXXX" />
        <SettingsButton type="submit" variant="primary" disabled={savingGa}>
          Save
        </SettingsButton>
        {gaStatus ? <InlineNote>{gaStatus}</InlineNote> : null}
      </form>
    </div>
  );
}
