"use client";

import { useCallback, useEffect, useState } from "react";
import { FieldLabel, SettingsButton, SettingsPanel, StatusPill, TextField } from "@/components/settings/ui";
import type { MarketingPerson } from "@/lib/marketing/types";

const REASON_LABEL: Record<string, string> = {
  unsubscribe: "Unsubscribed",
  hard_bounce: "Cleaned — hard bounce",
  complaint: "Complaint",
  manual: "Manual suppression",
};

const HARD_BLOCK = new Set(["hard_bounce", "complaint", "manual"]);

export default function MarketingPersonClient({ personId }: { personId: string }) {
  const [person, setPerson] = useState<MarketingPerson | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: MarketingPerson) => {
    setPerson(next);
    setDisplayName(next.displayName ?? "");
    setCity(next.city ?? "");
    setRegion(next.region ?? "");
    setCountry(next.country ?? "");
    setTags(next.tags.join(", "));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketing/audience/${personId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load");
    apply(data.person as MarketingPerson);
  }, [apply, personId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  async function save(patch: Record<string, unknown>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/audience", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: personId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      apply(data.person as MarketingPerson);
      setMessage(data.skippedReason ? String(data.skippedReason) : success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!person) {
    return <p className="text-sm text-gray-400">{error || "Loading person…"}</p>;
  }

  const reasons = person.suppressionReasons ?? [];
  const blocked = reasons.some((reason) => HARD_BLOCK.has(reason));

  return (
    <div className="space-y-6">
      <SettingsPanel
        eyebrow="Audience"
        title={person.displayName || person.email}
        description={person.displayName ? person.email : person.acquisitionSource}
        actions={
          <>
            <StatusPill tone={person.status === "subscribed" ? "ok" : person.status === "unsubscribed" ? "off" : "neutral"}>
              {person.status}
            </StatusPill>
            <SettingsButton href="/admin/marketing/audience">Back</SettingsButton>
          </>
        }
      >
        {reasons.length ? (
          <p className="text-sm text-gray-300">{reasons.map((reason) => REASON_LABEL[reason] ?? reason).join(" · ")}</p>
        ) : (
          <p className="text-sm text-gray-500">No active suppression.</p>
        )}
      </SettingsPanel>

      <SettingsPanel title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextField value={displayName} onChange={setDisplayName} />
          </div>
          <div>
            <FieldLabel>City</FieldLabel>
            <TextField value={city} onChange={setCity} />
          </div>
          <div>
            <FieldLabel>State</FieldLabel>
            <TextField value={region} onChange={setRegion} />
          </div>
          <div>
            <FieldLabel>Country</FieldLabel>
            <TextField value={country} onChange={setCountry} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel hint="Comma-separated. Saving replaces the tag list.">Tags</FieldLabel>
            <TextField value={tags} onChange={setTags} placeholder="newsletter, group:shows" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SettingsButton
            variant="primary"
            disabled={busy}
            onClick={() =>
              save(
                {
                  displayName,
                  city,
                  region,
                  country,
                  tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
                },
                "Saved"
              )
            }
          >
            Save
          </SettingsButton>
          {person.status === "subscribed" ? (
            <SettingsButton
              variant="danger"
              disabled={busy}
              onClick={() => save({ status: "unsubscribed", marketingConsent: false }, "Unsubscribed")}
            >
              Unsubscribe
            </SettingsButton>
          ) : null}
          {person.status !== "subscribed" && !blocked ? (
            <SettingsButton
              disabled={busy}
              onClick={() => save({ status: "subscribed", marketingConsent: true }, "Subscribed again")}
            >
              Subscribe again
            </SettingsButton>
          ) : null}
        </div>
        {blocked ? (
          <p className="mt-3 text-sm text-gray-400">A hard bounce, complaint, or manual suppression stays in place.</p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-[var(--csc-accent)]">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </SettingsPanel>
    </div>
  );
}
