"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsButton, StatusPill } from "@/components/settings/ui";

type PitchRow = {
  id: string;
  name: string;
  title: string;
  prompt: string;
  live: boolean;
  protected: boolean;
  href: string;
  builtin: boolean;
};

export default function PitchesLibrary() {
  const router = useRouter();
  const [pitches, setPitches] = useState<PitchRow[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [password, setPassword] = useState("");
  const [live, setLive] = useState(true);

  async function reload() {
    const res = await fetch("/api/pitches", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load pitches");
    setPitches(data.pitches ?? []);
    if (data.error) setStatus(data.error);
  }

  useEffect(() => {
    reload().catch((err) => setStatus(err instanceof Error ? err.message : "Could not load pitches"));
  }, []);

  async function createPitch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, live, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the pitch");
      router.push(`/admin/settings/pitches/${data.pitch.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create the pitch");
      setBusy(false);
    }
  }

  async function duplicate(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/pitches/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not duplicate the pitch");
      await reload();
      setStatus(`Duplicated ${data.pitch?.name ?? "pitch"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not duplicate the pitch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={createPitch} className="border-b border-[var(--csc-row-divider)] pb-5">
        <p className="csc-eyebrow">New pitch</p>
        <label className="mt-3 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Internal name</span>
          <input
            value={name}
            required
            aria-label="Internal name"
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full border border-white/15 bg-black px-3 py-2 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Prompt</span>
          <textarea
            value={prompt}
            required
            rows={4}
            aria-label="Prompt"
            placeholder="What this pitch is for, who it is for, and the point it has to make."
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-1 w-full border border-white/15 bg-black px-3 py-2 text-sm leading-relaxed text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            aria-label="Page password"
            placeholder="Password, if you want one"
            onChange={(event) => setPassword(event.target.value)}
            className="w-56 border border-white/15 bg-black px-3 py-1.5 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
          <SettingsButton variant={live ? "primary" : "ghost"} onClick={() => setLive((on) => !on)}>
            {live ? "Live" : "Hidden"}
          </SettingsButton>
          <SettingsButton type="submit" variant="primary" disabled={busy || !name.trim() || !prompt.trim()}>
            Create pitch
          </SettingsButton>
        </div>
        {status ? <p className="mt-3 text-sm text-white/70">{status}</p> : null}
      </form>

      {!pitches ? (
        <p className="mt-4 text-sm text-white/70">Loading pitches…</p>
      ) : (
        <div className="csc-list mt-2">
          {pitches.map((pitch) => (
            <div key={pitch.id} className="csc-list-row">
              <Link href={`/admin/settings/pitches/${pitch.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{pitch.name}</span>
                {pitch.title !== pitch.name ? (
                  <span className="mt-1 block truncate text-sm text-gray-400">{pitch.title}</span>
                ) : null}
                <span className="mt-1 block truncate text-sm text-gray-500">{pitch.prompt}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill tone={pitch.live ? "ok" : "neutral"}>{pitch.live ? "Live" : "Hidden"}</StatusPill>
                  <StatusPill tone={pitch.protected ? "warn" : "neutral"}>
                    {pitch.protected ? "Password" : "Public"}
                  </StatusPill>
                  <span className="text-xs text-gray-500">{pitch.href}</span>
                </span>
              </Link>
              <div className="flex shrink-0 flex-wrap gap-2">
                <SettingsButton href={pitch.href} target="_blank">
                  View
                </SettingsButton>
                <SettingsButton disabled={busy} onClick={() => void duplicate(pitch.id)}>
                  Duplicate
                </SettingsButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
