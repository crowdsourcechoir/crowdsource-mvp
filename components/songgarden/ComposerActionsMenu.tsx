"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import JSZip from "jszip";
import {
  generateSongSeed,
  type GenerateSongSeedError,
} from "@/data/agentInterview";
import { compositionBriefAdminUrl } from "@/data/compositionClient";
import { fetchClipFile, type SonggardenClip } from "@/data/songgardenClient";
import {
  buildSoundPackLayout,
  soundPackReadme,
} from "@/lib/songgarden/sound-pack";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  eventId: string;
  eventSlug: string;
  agentThemeId?: string | null;
  clips: SonggardenClip[];
};

/** Toolbar dropdown: Composition Brief, Generate Song Seed, Download sound pack. */
export default function ComposerActionsMenu({
  eventId,
  eventSlug,
  agentThemeId,
  clips,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [exportingPack, setExportingPack] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleGenerateSeed() {
    if (!agentThemeId) {
      setError("Attach an agent theme on the bloom to unlock Song Seed.");
      setOpen(false);
      return;
    }
    setLoadingSeed(true);
    setError(null);
    setStatus(null);
    try {
      await generateSongSeed(eventId);
      setStatus("seed");
    } catch (err) {
      const e = err as GenerateSongSeedError;
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoadingSeed(false);
      setOpen(false);
    }
  }

  async function handleExportPack() {
    if (clips.length === 0) return;
    setExportingPack(true);
    setError(null);
    setStatus(null);
    try {
      const { entries, manifest } = buildSoundPackLayout({
        eventId,
        eventSlug,
        clips,
      });
      const fileByClipId = new Map<string, File>();
      for (const clip of Array.from(new Map(clips.map((c) => [c.id, c])).values())) {
        fileByClipId.set(clip.id, await fetchClipFile(eventId, clip));
      }
      const zip = new JSZip();
      const root = `${eventSlug}_sound-pack`;
      zip.file(
        `${root}/README.txt`,
        soundPackReadme(eventSlug, clips.length, manifest.kitClipCount)
      );
      zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));
      for (const entry of entries) {
        const file = fileByClipId.get(entry.clip.id);
        if (file) zip.file(`${root}/${entry.path}`, file);
      }
      downloadBlob(
        await zip.generateAsync({ type: "blob" }),
        `${eventSlug}_sound-pack.zip`
      );
      setStatus(`Downloaded sound pack (${clips.length}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build sound pack.");
    } finally {
      setExportingPack(false);
      setOpen(false);
    }
  }

  const busy = loadingSeed || exportingPack;
  const briefHref = compositionBriefAdminUrl({ eventId });

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex max-w-[14rem] items-center gap-2 rounded-lg border border-white/15 bg-black px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-[var(--csc-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="truncate text-gray-500">Actions</span>
          <span className="truncate text-white">
            {busy ? (loadingSeed ? "Generating…" : "Building…") : "Song & pack"}
          </span>
          <span className="text-gray-500" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul
            id={menuId}
            role="menu"
            className="absolute right-0 z-30 mt-1 min-w-[13rem] overflow-hidden rounded-lg border border-white/15 bg-black py-1 shadow-xl sm:left-0 sm:right-auto"
          >
            <li role="none">
              <Link
                href={briefHref}
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-xs text-gray-200 transition-colors hover:bg-[var(--csc-accent)]/10 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Composition Brief
              </Link>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={loadingSeed || !agentThemeId}
                className="flex w-full px-3 py-1.5 text-left text-xs text-gray-200 transition-colors hover:bg-[var(--csc-accent)]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void handleGenerateSeed()}
                title={
                  agentThemeId
                    ? undefined
                    : "Attach an agent theme on the bloom to unlock Song Seed"
                }
              >
                {loadingSeed ? "Generating…" : "Generate Song Seed"}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={exportingPack || clips.length === 0}
                className="flex w-full px-3 py-1.5 text-left text-xs text-gray-200 transition-colors hover:bg-[var(--csc-accent)]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void handleExportPack()}
                title="WAV zip for Ableton / MPC"
              >
                {exportingPack
                  ? "Building…"
                  : `Download sound pack${clips.length ? ` (${clips.length})` : ""}`}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {error ? <p className="max-w-xs text-[11px] text-rose-400">{error}</p> : null}
      {status === "seed" && !error ? (
        <p className="max-w-xs text-[11px] text-gray-400">
          Song seed ready —{" "}
          <Link href={briefHref} className="text-[#CFFF81] hover:underline">
            open Composition Brief
          </Link>
        </p>
      ) : null}
      {status && status !== "seed" && !error ? (
        <p className="max-w-xs text-[11px] text-gray-400">{status}</p>
      ) : null}
    </div>
  );
}
