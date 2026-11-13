"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QueueFilterSelect from "@/components/sales/QueueFilterSelect";
import {
  PITCH_CATEGORY_FILTERS,
  PITCH_CATEGORY_OPTIONS,
  PITCH_WORK_FILTERS,
  PITCH_WORK_OPTIONS,
  countPitchCategories,
  countPitchWork,
  pitchMatchesCategory,
  pitchMatchesQuery,
  pitchMatchesWork,
} from "@/lib/pitches/library";
import type { QueueCategoryFilter } from "@/lib/sales/queue/category";
import type { QueueWorkstreamFilter } from "@/lib/sales/queue/workstream";
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
  workstream: string | null;
  updatedAt: string;
};

const fieldClass =
  "border border-white/15 bg-black px-2 py-1 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none";

export default function PitchesLibrary({ title }: { title: string }) {
  const router = useRouter();
  const [pitches, setPitches] = useState<PitchRow[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [password, setPassword] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [workDraft, setWorkDraft] = useState("");
  const [live, setLive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [workFilter, setWorkFilter] = useState<QueueWorkstreamFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<QueueCategoryFilter>("all");
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

  const workCounts = useMemo(() => countPitchWork((pitches ?? []).map((pitch) => pitch.workstream)), [pitches]);
  const categoryCounts = useMemo(() => countPitchCategories((pitches ?? []).map((pitch) => pitch.category)), [pitches]);
  const visible = useMemo(
    () =>
      (pitches ?? []).filter(
        (pitch) =>
          pitchMatchesWork(pitch.workstream, workFilter) &&
          pitchMatchesCategory(pitch.category, categoryFilter) &&
          pitchMatchesQuery(pitch, query)
      ),
    [pitches, workFilter, categoryFilter, query]
  );

  async function createPitch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, live, password, category: categoryDraft, workstream: workDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the pitch");
      router.push(`/admin/settings/pitches/${data.pitch.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create the pitch");
      setBusy(false);
    }
  }

  async function copyUrl(pitch: PitchRow) {
    const url = new URL(pitch.href, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) {
        setStatus("Could not copy that URL.");
        return;
      }
    }
    setCopiedId(pitch.id);
    window.setTimeout(() => setCopiedId((current) => (current === pitch.id ? null : current)), 1600);
  }

  return (
    <SettingsSubpage
      eyebrow="Content"
      title={title}
      actions={
        <>
          <input
            value={query}
            type="search"
            aria-label="Search pitches"
            placeholder="Search…"
            onChange={(event) => setQuery(event.target.value)}
            className={`w-36 min-w-0 sm:w-56 ${fieldClass}`}
          />
          <SettingsButton variant="primary" expanded={creating} onClick={() => setCreating((open) => !open)}>
            New pitch
          </SettingsButton>
        </>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <FilingSelect
              label="Work"
              value={workDraft}
              options={PITCH_WORK_OPTIONS}
              onChange={setWorkDraft}
            />
            <FilingSelect
              label="Category"
              value={categoryDraft}
              options={PITCH_CATEGORY_OPTIONS}
              onChange={setCategoryDraft}
            />
          </div>
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
        <QueueFilterSelect
          label="Work"
          value={workFilter}
          options={PITCH_WORK_FILTERS.map((option) => ({
            key: option.key,
            label: option.label,
            count: workCounts[option.key],
          }))}
          onChange={setWorkFilter}
        />
        <QueueFilterSelect
          label="Category"
          value={categoryFilter}
          options={PITCH_CATEGORY_FILTERS.map((option) => ({
            key: option.key,
            label: option.label,
            count: categoryCounts[option.key],
          }))}
          onChange={setCategoryFilter}
        />
      </div>

      {!pitches ? (
        <p className="mt-4 text-sm text-white/70">Loading pitches…</p>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-white/70">No pitches match.</p>
      ) : (
        <div className="csc-list mt-2">
          {visible.map((pitch) => (
            <div key={pitch.id} className="csc-list-row">
              <Link href={`/admin/settings/pitches/${pitch.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {pitch.name}
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    pitch.live ? "text-[var(--csc-accent)]" : "text-white/40"
                  }`}
                >
                  {pitch.live ? "Live" : "Hidden"}
                </span>
                {pitch.protected ? <LockMark /> : null}
                <button
                  type="button"
                  className="csc-btn-circle"
                  aria-label={copiedId === pitch.id ? `Copied URL for ${pitch.name}` : `Copy URL for ${pitch.name}`}
                  title={copiedId === pitch.id ? "Copied" : "Copy URL"}
                  onClick={() => void copyUrl(pitch)}
                >
                  {copiedId === pitch.id ? <CheckIcon /> : <CopyIcon />}
                </button>
                <a href={pitch.href} target="_blank" rel="noreferrer" className="csc-link text-sm font-semibold">
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSubpage>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.75 4.25V2.75A1.25 1.25 0 0 0 8.5 1.5H2.75A1.25 1.25 0 0 0 1.5 2.75V8.5a1.25 1.25 0 0 0 1.25 1.25H4.25" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7.2 5.6 9.8 11 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockMark() {
  return (
    <span role="img" title="Password protected" aria-label="Password protected" className="text-white/55">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <rect x="2.75" y="6" width="8.5" height="6.25" rx="1.25" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 6V4.4a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </span>
  );
}

function FilingSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ key: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-[9.25rem] shrink-0 ${fieldClass} text-xs ${value ? "text-white" : "text-white/45"}`}
    >
      <option value="">{placeholder ?? label}</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
