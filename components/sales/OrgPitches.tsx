"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsButton } from "@/components/settings/ui";

type PitchRow = {
  id: string;
  name: string;
  href: string;
  live: boolean;
};

export default function OrgPitches({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [pitches, setPitches] = useState<PitchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pitches?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load pitches");
        if (!cancelled) setPitches(data.pitches ?? []);
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Could not load pitches");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  async function startPitch() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${organizationName} pitch`.slice(0, 80),
          prompt: `A pitch for ${organizationName}.`,
          live: false,
          organizationId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.pitch?.id) throw new Error(data.error ?? "Could not start the pitch");
      router.push(`/admin/settings/pitches/${data.pitch.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not start the pitch");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--csc-row-divider)] pt-3">
      <p className="csc-eyebrow">Pitch</p>
      {pitches && pitches.length > 0 ? (
        <div className="csc-list mt-2">
          {pitches.map((pitch) => (
            <div key={pitch.id} className="csc-list-row">
              <Link href={`/admin/settings/pitches/${pitch.id}`} className="csc-link min-w-0 flex-1 truncate text-sm">
                {pitch.name}
              </Link>
              <Link href={pitch.href} target="_blank" className="shrink-0 text-xs text-white/50">
                {pitch.live ? "View" : "Hidden"}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-white/50">{pitches ? "No pitch yet." : "Loading pitches…"}</p>
      )}
      <div className="mt-2">
        <SettingsButton variant="primary" disabled={busy} onClick={() => void startPitch()}>
          {busy ? "Starting…" : "Start a pitch"}
        </SettingsButton>
      </div>
      {status ? <p className="mt-2 text-xs text-white/70">{status}</p> : null}
    </div>
  );
}
