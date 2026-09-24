"use client";

import { useEffect, useState } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { DEFAULT_COPY_COLOR } from "@/lib/sobeca-pitch/copy";

function slideLabel(slide: PitchSlide): string {
  const titled = slide.blocks.find((block) => block.type === "title" || block.type === "heading");
  return titled && "text" in titled ? titled.text : slide.id;
}

function updateBlock(slide: PitchSlide, index: number, block: CopyBlock): PitchSlide {
  const blocks = slide.blocks.slice();
  blocks[index] = block;
  return { ...slide, blocks };
}

export default function SongGardenPitchEditor() {
  const [slides, setSlides] = useState<PitchSlide[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pagePassword, setPagePassword] = useState("");
  const [passwordOn, setPasswordOn] = useState(false);

  useEffect(() => {
    fetch("/api/sobeca-song-garden/access", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setPasswordOn(Boolean(data.protected));
      })
      .catch(() => undefined);
    fetch("/api/sobeca-song-garden/copy", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load copy");
        setSlides(data.slides);
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : "Could not load copy"));
  }, []);

  async function save(next: PitchSlide[] | null) {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sobeca-song-garden/copy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { slides: next } : { reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSlides(data.slides);
      setStatus(next ? "Saved. The public page is using this copy." : "Reset to the copy in the site file.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function replacePhoto(slide: PitchSlide, file: File) {
    setUploadingId(slide.id);
    setStatus(null);
    try {
      const prepared = await fetch("/api/sobeca-song-garden/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideId: slide.id, name: file.name, contentType: file.type, size: file.size }),
      });
      const prep = await prepared.json();
      if (!prepared.ok) throw new Error(prep.error ?? "Could not prepare upload");
      const put = await fetch(prep.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": prep.upload.contentType },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      const next = (slides ?? []).map((item) =>
        item.id === slide.id ? { ...item, image: prep.upload.publicUrl as string } : item
      );
      setSlides(next);
      await save(next);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  if (!slides) {
    return <p className="text-sm text-white/70">{status ?? "Loading copy…"}</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-[var(--csc-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)] hover:bg-[var(--csc-accent)] hover:text-black disabled:opacity-50"
          disabled={saving}
          onClick={() => save(slides)}
        >
          Save
        </button>
        <button type="button" className="csc-link text-sm" disabled={saving} onClick={() => save(null)}>
          Reset to file
        </button>
        <a className="csc-link text-sm" href="/sobeca-song-garden" target="_blank" rel="noreferrer">
          View page
        </a>
        {status ? <p className="text-sm text-white/70">{status}</p> : null}
      </div>
      <form
        className="max-w-md space-y-3 border border-white/15 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setStatus(null);
          try {
            const res = await fetch("/api/sobeca-song-garden/access", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: pagePassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Could not save the password");
            setPasswordOn(true);
            setPagePassword("");
            setStatus("Password saved. The public page now asks for it.");
          } catch (err) {
            setStatus(err instanceof Error ? err.message : "Could not save the password");
          } finally {
            setSaving(false);
          }
        }}
      >
        <p className="text-sm text-white">{passwordOn ? "This page asks for a password." : "This page is public."}</p>
        <label className="block text-sm text-white/70">
          Page password
          <input
            type="password"
            value={pagePassword}
            autoComplete="new-password"
            placeholder={passwordOn ? "Enter a new password to replace it" : "Leave blank to keep the page public"}
            onChange={(event) => setPagePassword(event.target.value)}
            className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-white"
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={saving || !pagePassword.trim()}
            className="rounded-full border border-[var(--csc-accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)] hover:bg-[var(--csc-accent)] hover:text-black disabled:opacity-50"
          >
            Save password
          </button>
          {passwordOn ? (
            <button
              type="button"
              className="csc-link text-sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setStatus(null);
                try {
                  const res = await fetch("/api/sobeca-song-garden/access", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clear: true }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? "Could not remove the password");
                  setPasswordOn(false);
                  setPagePassword("");
                  setStatus("Password removed. The page is public.");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Could not remove the password");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Remove password
            </button>
          ) : null}
        </div>
      </form>
      {slides.map((slide, slideIndex) => (
        <section key={slide.id} className="space-y-4">
          <h2 className="csc-eyebrow">{slideLabel(slide)}</h2>
          <label className="flex flex-wrap items-center gap-3 text-sm text-white">
            Copy color
            <input
              type="color"
              value={slide.copyColor || DEFAULT_COPY_COLOR}
              aria-label={`Copy color for ${slideLabel(slide)}`}
              className="h-8 w-12 cursor-pointer bg-transparent"
              onChange={(event) => {
                const next = slides.slice();
                next[slideIndex] = { ...slide, copyColor: event.target.value.toUpperCase() };
                setSlides(next);
              }}
            />
            <span className="font-mono text-xs text-white/70">{slide.copyColor || DEFAULT_COPY_COLOR}</span>
          </label>
          <div className="max-w-xl">
            <img src={slide.image} alt="" className="h-40 w-full object-cover" />
            <label className="csc-link mt-2 inline-block text-sm">
              {uploadingId === slide.id ? "Uploading…" : "Replace photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={uploadingId !== null || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void replacePhoto(slide, file);
                }}
              />
            </label>
          </div>
          {slide.blocks.map((block, blockIndex) => {
            if (block.type === "image") return null;
            if (block.type === "list") {
              return (
                <label key={blockIndex} className="block text-sm">
                  List
                  {block.items.map((item, itemIndex) => (
                    <textarea
                      key={itemIndex}
                      className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-white"
                      rows={2}
                      value={item}
                      onChange={(event) => {
                        const items = block.items.slice();
                        items[itemIndex] = event.target.value;
                        const next = slides.slice();
                        next[slideIndex] = updateBlock(slide, blockIndex, { ...block, items });
                        setSlides(next);
                      }}
                    />
                  ))}
                </label>
              );
            }
            if (block.type === "table") {
              return (
                <div key={blockIndex} className="space-y-2">
                  {block.rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid gap-2 sm:grid-cols-2">
                      {row.map((cell, cellIndex) => (
                        <textarea
                          key={cellIndex}
                          className="w-full border border-white/15 bg-black px-3 py-2 text-sm text-white"
                          rows={3}
                          value={cell}
                          aria-label={block.headers[cellIndex] ?? "Cell"}
                          onChange={(event) => {
                            const rows = block.rows.map((current) => current.slice());
                            rows[rowIndex][cellIndex] = event.target.value;
                            const next = slides.slice();
                            next[slideIndex] = updateBlock(slide, blockIndex, { ...block, rows });
                            setSlides(next);
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <label key={blockIndex} className="block text-sm text-white/70">
                {block.type}
                <textarea
                  className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-white"
                  rows={block.type === "paragraph" ? 5 : 2}
                  value={block.text}
                  onChange={(event) => {
                    const next = slides.slice();
                    next[slideIndex] = updateBlock(slide, blockIndex, { ...block, text: event.target.value });
                    setSlides(next);
                  }}
                />
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}
