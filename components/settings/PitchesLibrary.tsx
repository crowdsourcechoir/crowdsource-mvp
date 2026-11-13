"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pitchCategoryNames, pitchInCategory, pitchMatchesQuery } from "@/lib/pitches/library";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import { SettingsButton } from "@/components/settings/ui";

type PitchRow = {
  id: string;
  name: string;
  title: string;
  prompt: string;
  live: boolean;
  protected: boolean;
  href: string;
  builtin: boolean;
  organizationName: string | null;
  category: string | null;
  updatedAt: string;
};

const fieldClass =
  "border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none";

export default function PitchesLibrary({ title, description }: { title: string; description: string }) {
  const router = useRouter();
  const [pitches, setPitches] = useState<PitchRow[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [password, setPassword] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [live, setLive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("*");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) nameRef.current?.focus();
  }, [creating]);

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

  const categories = useMemo(() => pitchCategoryNames((pitches ?? []).map((pitch) => pitch.category)), [pitches]);
  const uncategorized = (pitches ?? []).some((pitch) => !pitch.category);
  const visible = useMemo(
    () =>
      (pitches ?? []).filter(
        (pitch) => pitchInCategory(pitch.category, categoryFilter) && pitchMatchesQuery(pitch, query)
      ),
    [pitches, categoryFilter, query]
  );

  async function createPitch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, live, password, category: categoryDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the pitch");
      router.push(`/admin/settings/pitches/${data.pitch.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create the pitch");
      setBusy(false);
    }
  }

  async function saveUrl(pitch: PitchRow) {
    const next = (urls[pitch.id] ?? pitch.href).trim();
    if (!next || next === pitch.href) return;
    setSavingUrl(pitch.id);
    setStatus(null);
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save that address");
      setUrls((current) => {
        const copy = { ...current };
        delete copy[pitch.id];
        return copy;
      });
      await reload();
      setStatus(`Address saved. The page is now ${data.pitch?.href ?? next}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save that address");
    } finally {
      setSavingUrl(null);
    }
  }

  async function saveCategory(pitch: PitchRow, value: string) {
    const next = value.trim().replace(/\s+/g, " ");
    if (next === (pitch.category ?? "")) return;
    setStatus(null);
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the category");
      await reload();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save the category");
    }
  }

  async function duplicate(id: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/pitches/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not duplicate the pitch");
      setCategoryFilter("*");
      setQuery("");
      await reload();
      setStatus(`Duplicated ${data.pitch?.name ?? "pitch"}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not duplicate the pitch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSubpage
      eyebrow="Content"
      title={title}
      description={description}
      actions={
        <SettingsButton variant="primary" expanded={creating} onClick={() => setCreating((open) => !open)}>
          New pitch
        </SettingsButton>
      }
    >
      {creating ? (
        <form onSubmit={createPitch} className="border-b border-[var(--csc-row-divider)] pb-5">
          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Internal name</span>
            <input
              ref={nameRef}
              value={name}
              required
              aria-label="Internal name"
              onChange={(event) => setName(event.target.value)}
              className={`mt-1 w-full ${fieldClass} px-3 py-2`}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Category</span>
            <input
              value={categoryDraft}
              aria-label="Category"
              list="pitch-categories"
              placeholder="Conference, partnership, internal"
              onChange={(event) => setCategoryDraft(event.target.value)}
              className={`mt-1 w-full ${fieldClass} px-3 py-2`}
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
              className={`mt-1 w-full ${fieldClass} px-3 py-2 leading-relaxed`}
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
              className={`w-56 ${fieldClass} px-3 py-1.5`}
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
      ) : status ? (
        <p className="mt-3 text-sm text-white/70">{status}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          aria-label="Search pitches"
          placeholder="Search pitches"
          onChange={(event) => setQuery(event.target.value)}
          className={`w-full sm:w-64 ${fieldClass}`}
        />
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Categories">
            <FilterChip pressed={categoryFilter === "*"} onClick={() => setCategoryFilter("*")}>
              All
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category}
                pressed={categoryFilter.toLowerCase() === category.toLowerCase()}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </FilterChip>
            ))}
            {uncategorized ? (
              <FilterChip pressed={categoryFilter === "?"} onClick={() => setCategoryFilter("?")}>
                Uncategorized
              </FilterChip>
            ) : null}
          </div>
        ) : null}
      </div>

      {!pitches ? (
        <p className="mt-4 text-sm text-white/70">Loading pitches…</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-white/70">No pitches match.</p>
      ) : (
        <div className="csc-list mt-2">
          <datalist id="pitch-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          {visible.map((pitch) => (
            <div key={pitch.id} className="csc-list-row gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Link href={`/admin/settings/pitches/${pitch.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {pitch.name}
                </Link>
                <input
                  key={`${pitch.id}:${pitch.category ?? ""}`}
                  defaultValue={pitch.category ?? ""}
                  aria-label={`Category for ${pitch.name}`}
                  list="pitch-categories"
                  placeholder="Category"
                  onBlur={(event) => void saveCategory(pitch, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  className={`w-28 shrink-0 ${fieldClass} text-xs text-[var(--csc-accent)] placeholder:text-white/30`}
                />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  {pitch.live ? "Live" : "Hidden"}
                  {pitch.protected ? " · Password" : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveUrl(pitch);
                  }}
                >
                  <label className="block">
                    <span className="sr-only">URL for {pitch.name}</span>
                    <input
                      value={urls[pitch.id] ?? pitch.href}
                      spellCheck={false}
                      aria-label={`URL for ${pitch.name}`}
                      disabled={savingUrl === pitch.id}
                      onChange={(event) => setUrls((current) => ({ ...current, [pitch.id]: event.target.value }))}
                      onBlur={() => void saveUrl(pitch)}
                      className={`w-44 sm:w-72 ${fieldClass} font-mono text-xs disabled:opacity-50`}
                    />
                  </label>
                </form>
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
    </SettingsSubpage>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        pressed
          ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
          : "border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
