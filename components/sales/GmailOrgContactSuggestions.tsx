"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SettingsButton } from "@/components/settings/ui";

export type GmailContactSuggestionView = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  reason: string;
  prompt: string;
  sampleSubject: string | null;
};

export default function GmailOrgContactSuggestions({
  organizationId,
  onApproved,
}: {
  organizationId?: string;
  onApproved?: (message: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<GmailContactSuggestionView[]>([]);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
      const res = await fetch(`/api/sales/gmail/contact-suggestions${query}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: GmailContactSuggestionView[];
        lastScannedAt?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not load suggestions");
      setSuggestions(data.suggestions ?? []);
      setLastScannedAt(data.lastScannedAt ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load suggestions");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function scan() {
    setScanning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/gmail/contact-suggestions/scan", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { messagesRead?: number; pending?: number; proposed?: number };
      };
      if (!res.ok) throw new Error(data.error || "Could not scan Gmail");
      const pending = data.result?.pending ?? 0;
      setMessage(
        pending
          ? `Scanned ${data.result?.messagesRead ?? 0} messages. ${pending} ${pending === 1 ? "person is" : "people are"} waiting for approval.`
          : `Scanned ${data.result?.messagesRead ?? 0} messages. No new people to approve.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan Gmail");
    } finally {
      setScanning(false);
    }
  }

  async function decide(id: string, action: "approve" | "dismiss") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/sales/gmail/contact-suggestions/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Could not update suggestion");
      setSuggestions((current) => current.filter((row) => row.id !== id));
      if (data.message) setMessage(data.message);
      if (action === "approve" && data.message) onApproved?.(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update suggestion");
    } finally {
      setBusyId(null);
    }
  }

  const visible = suggestions.slice(0, organizationId ? 12 : 20);
  const scannedLabel = lastScannedAt
    ? `Last scan ${new Date(lastScannedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : "Not scanned yet";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="csc-eyebrow">From your Gmail</p>
          <p className="mt-2 text-sm text-gray-400">
            {organizationId
              ? "People in your inbox who look like they belong here. Nothing is added until you approve."
              : "People in your inbox matched to an organization. Nothing is added until you approve."}
          </p>
        </div>
        <SettingsButton variant="primary" disabled={scanning} onClick={() => void scan()}>
          {scanning ? "Scanning…" : "Scan inbox"}
        </SettingsButton>
      </div>
      <p className="text-xs text-gray-500">{scannedLabel}</p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--csc-accent)]">{message}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading suggestions…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="text-sm text-gray-500">No one is waiting for approval.</p>
      ) : null}
      {visible.length > 0 ? (
        <ul className="csc-list">
          {visible.map((suggestion) => (
            <li key={suggestion.id} className="csc-list-row items-start gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white">{suggestion.prompt}</p>
                <p className="mt-1 text-xs text-gray-500">{suggestion.reason}</p>
                {suggestion.sampleSubject ? (
                  <p className="mt-1 text-xs text-gray-500">Subject: {suggestion.sampleSubject}</p>
                ) : null}
                {!organizationId ? (
                  <Link href={`/admin/sales/organizations/${suggestion.organizationId}`} className="csc-link mt-1 inline-block text-xs">
                    {suggestion.organizationName}
                  </Link>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <SettingsButton
                  variant="primary"
                  disabled={busyId === suggestion.id}
                  onClick={() => void decide(suggestion.id, "approve")}
                >
                  Add
                </SettingsButton>
                <SettingsButton disabled={busyId === suggestion.id} onClick={() => void decide(suggestion.id, "dismiss")}>
                  Not now
                </SettingsButton>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {suggestions.length > visible.length ? (
        <p className="text-xs text-gray-500">{suggestions.length - visible.length} more waiting.</p>
      ) : null}
    </section>
  );
}
