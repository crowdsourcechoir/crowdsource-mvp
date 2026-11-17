"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/settings/ui";
import { formatPacificWhen } from "@/lib/sales/autosend/policy";
import type { AutoSendQueueView } from "@/lib/sales/autosend/view";
import type { AutoSendSlot } from "@/lib/sales/autosend/types";

function statusLabel(slot: AutoSendSlot): string {
  if (slot.status === "sent") return "Sent";
  if (slot.status === "sending") return "Sending";
  if (slot.status === "failed") return "Failed";
  if (slot.status === "skipped") return "Skipped";
  return "In line";
}

function statusTone(slot: AutoSendSlot): "ok" | "warn" | "off" | "neutral" {
  if (slot.status === "sent") return "ok";
  if (slot.status === "failed" || slot.status === "skipped") return "warn";
  if (slot.status === "sending") return "ok";
  return "neutral";
}

export default function AutoSendQueueClient() {
  const [view, setView] = useState<AutoSendQueueView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/autosend", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load the send queue");
      setView(data as AutoSendQueueView);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the send queue");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="w-full text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Prospecting Intelligence</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Sending</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            25 verified first-touch emails on weekdays, spaced from 8:00am to 4:30pm Pacific. A full report arrives after that day’s sends finish.
          </p>
        </div>
        <Link href="/admin/settings/autosend" className="csc-link text-sm">
          Pause or resume →
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {view?.storeError ? <p className="mt-4 text-sm text-amber-200">{view.storeError}</p> : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {view ? (
          <>
            <StatusPill tone={view.enabled ? "ok" : "off"}>{view.enabled ? "On" : "Paused"}</StatusPill>
            <StatusPill tone={view.gmailSendsEnabled ? "ok" : "warn"}>
              {view.gmailSendsEnabled ? "Gmail sending on" : "Gmail sending paused"}
            </StatusPill>
            <span className="text-sm text-gray-300">
              {view.sentToday} of {view.dailyCap} sent today · {view.weekSent} of {view.weeklyCap} this week
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-500">Loading the line…</span>
        )}
      </div>
      {view?.nextSendAt ? (
        <p className="mt-3 text-sm text-gray-400">Next send {formatPacificWhen(view.nextSendAt)} Pacific.</p>
      ) : view && !view.storeError ? (
        <p className="mt-3 text-sm text-gray-400">Nothing is waiting on the clock.</p>
      ) : null}
      {view && !view.gmailSendsEnabled ? (
        <p className="mt-3 text-sm text-amber-200">
          Resume Gmail sending on Sales before the window opens. The line stays put until then.
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {(view?.groups ?? []).map((group) => (
          <section key={group.key}>
            <p className="csc-eyebrow">{group.label}</p>
            {group.slots.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                {group.key === "today" ? "No sends left in today’s window." : "None yet."}
              </p>
            ) : (
              <ul className="csc-list mt-3">
                {group.slots.map((slot) => (
                  <li key={`${slot.day}-${slot.queueItemId}`} className="csc-list-row">
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {formatPacificWhen(slot.sentAt ?? slot.scheduledAt)} Pacific · score {Math.round(slot.score)}
                        </p>
                        <Link href={`/admin/sales/opportunities/${slot.opportunityId}`} className="mt-1 block truncate text-sm font-medium text-white hover:underline">
                          {slot.organizationName}
                        </Link>
                        <p className="mt-1 truncate text-xs text-gray-400">
                          {slot.contactName ? `${slot.contactName} · ` : ""}
                          {slot.contactEmail}
                          {slot.eventDate ? ` · ${slot.eventTitle} · ${slot.eventDate}` : ""}
                        </p>
                        {slot.error ? <p className="mt-1 text-xs text-amber-200">{slot.error}</p> : null}
                      </div>
                      <StatusPill tone={statusTone(slot)}>{statusLabel(slot)}</StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
