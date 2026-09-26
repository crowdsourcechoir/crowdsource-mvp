"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { DEFAULT_COPY_COLOR } from "@/lib/sobeca-pitch/copy";
import { SettingsButton } from "@/components/settings/ui";

function slideLabel(slide: PitchSlide): string {
  const titled = slide.blocks.find((block) => block.type === "title" || block.type === "heading");
  return titled && "text" in titled ? titled.text : slide.id;
}

function updateBlock(slide: PitchSlide, index: number, block: CopyBlock): PitchSlide {
  const blocks = slide.blocks.slice();
  blocks[index] = block;
  return { ...slide, blocks };
}

const BLOCK_LABEL: Record<string, string> = {
  title: "Title",
  kicker: "Kicker",
  heading: "Heading",
  line: "Line",
  paragraph: "Paragraph",
};

function FitText({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <label className="block border-b border-[var(--csc-row-divider)] py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">{label}</span>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full resize-none bg-transparent text-sm leading-snug text-white focus:outline-none"
      />
    </label>
  );
}

export default function SongGardenPitchEditor() {
  const [slides, setSlides] = useState<PitchSlide[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pagePassword, setPagePassword] = useState("");
  const [passwordOn, setPasswordOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        setActiveId((current) => current ?? data.slides?.[0]?.id ?? null);
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
      setStatus(next ? "Saved." : "Reset to the file.");
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

  function jump(id: string) {
    setActiveId(id);
    document.getElementById(`pitch-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function patchSlide(id: string, recipe: (slide: PitchSlide) => PitchSlide) {
    setSlides((current) => current?.map((item) => (item.id === id ? recipe(item) : item)) ?? current);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--csc-row-divider)] pb-3">
        <SettingsButton variant="primary" disabled={saving} onClick={() => save(slides)}>
          Save
        </SettingsButton>
        <SettingsButton disabled={saving} onClick={() => save(null)}>
          Reset
        </SettingsButton>
        <SettingsButton href="/sobeca-song-garden" target="_blank">
          View
        </SettingsButton>
        <SettingsButton onClick={() => setShowPassword((open) => !open)}>
          {passwordOn ? "Password on" : "Password"}
        </SettingsButton>
        {status ? <p className="text-sm text-white/70">{status}</p> : null}
      </div>

      {showPassword ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-[var(--csc-row-divider)] py-3"
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
              setStatus("Password saved.");
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Could not save the password");
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="text-sm text-white/70">{passwordOn ? "This page asks for a password." : "This page is public."}</p>
          <input
            type="password"
            value={pagePassword}
            autoComplete="new-password"
            aria-label="Page password"
            placeholder={passwordOn ? "New password" : "Set a password"}
            onChange={(event) => setPagePassword(event.target.value)}
            className="w-48 border border-white/15 bg-black px-3 py-1.5 text-sm text-white focus:border-[var(--csc-accent)] focus:outline-none"
          />
          <SettingsButton type="submit" variant="primary" disabled={saving || !pagePassword.trim()}>
            Save password
          </SettingsButton>
          {passwordOn ? (
            <SettingsButton
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
                  setStatus("Password removed.");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Could not remove the password");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Remove
            </SettingsButton>
          ) : null}
        </form>
      ) : null}

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-[var(--csc-row-divider)] bg-black px-4 py-2 lg:hidden">
        <p className="csc-eyebrow">Sections</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {slides.map((item, index) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                className={`shrink-0 border px-3 py-1.5 text-xs ${
                  selected
                    ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                    : "border-white/15 text-white"
                }`}
              >
                {index + 1}. {slideLabel(item)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <nav className="csc-list sticky top-4 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto lg:block">
          {slides.map((item, index) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                className="csc-list-row w-full text-left"
                style={selected ? { outlineColor: "var(--csc-accent)" } : undefined}
              >
                <span className="w-5 shrink-0 text-xs text-white/50">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{slideLabel(item)}</span>
              </button>
            );
          })}
        </nav>

        <div>
          {slides.map((slide, index) => (
            <section key={slide.id} id={`pitch-${slide.id}`} className="scroll-mt-24 border-b border-[var(--csc-row-divider)] py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate text-base font-semibold text-white">
                  <span className="mr-2 text-white/40">{index + 1}</span>
                  {slideLabel(slide)}
                </h2>
                <label className="flex shrink-0 items-center gap-2 text-xs text-white/70">
                  <input
                    type="color"
                    value={slide.copyColor || DEFAULT_COPY_COLOR}
                    aria-label={`Copy color for ${slideLabel(slide)}`}
                    className="h-6 w-8 cursor-pointer bg-transparent"
                    onChange={(event) =>
                      patchSlide(slide.id, (current) => ({ ...current, copyColor: event.target.value.toUpperCase() }))
                    }
                  />
                  <span className="font-mono">{slide.copyColor || DEFAULT_COPY_COLOR}</span>
                </label>
              </div>

              <div className="relative mt-3">
                <img src={slide.image} alt="" className="h-28 w-full object-cover" />
                <label className="csc-link absolute bottom-2 right-2 bg-black/70 px-2 py-1 text-xs">
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

              <div className="mt-2">
                {slide.blocks.map((block, blockIndex) => {
                  if (block.type === "image") return null;
                  if (block.type === "list") {
                    return (
                      <div key={blockIndex}>
                        {block.items.map((item, itemIndex) => (
                          <FitText
                            key={itemIndex}
                            label={`Item ${itemIndex + 1}`}
                            value={item}
                            onChange={(value) =>
                              patchSlide(slide.id, (current) => {
                                const existing = current.blocks[blockIndex];
                                if (existing?.type !== "list") return current;
                                const items = existing.items.slice();
                                items[itemIndex] = value;
                                return updateBlock(current, blockIndex, { ...existing, items });
                              })
                            }
                          />
                        ))}
                      </div>
                    );
                  }
                  if (block.type === "table") {
                    return (
                      <div key={blockIndex} className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
                          {block.headers.join(" · ")}
                        </p>
                        {block.rows.map((row, rowIndex) => (
                          <div key={rowIndex} className="grid gap-x-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
                            {row.map((cell, cellIndex) => (
                              <FitText
                                key={cellIndex}
                                label={block.headers[cellIndex] ?? "Cell"}
                                value={cell}
                                onChange={(value) =>
                                  patchSlide(slide.id, (current) => {
                                    const existing = current.blocks[blockIndex];
                                    if (existing?.type !== "table") return current;
                                    const rows = existing.rows.map((currentRow) => currentRow.slice());
                                    rows[rowIndex][cellIndex] = value;
                                    return updateBlock(current, blockIndex, { ...existing, rows });
                                  })
                                }
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <FitText
                      key={blockIndex}
                      label={BLOCK_LABEL[block.type] ?? block.type}
                      value={block.text}
                      onChange={(value) =>
                        patchSlide(slide.id, (current) => {
                          const existing = current.blocks[blockIndex];
                          if (!existing || !("text" in existing)) return current;
                          return updateBlock(current, blockIndex, { ...existing, text: value });
                        })
                      }
                    />
                  );
                })}
              </div>

              {index < slides.length - 1 ? (
                <button
                  type="button"
                  onClick={() => jump(slides[index + 1].id)}
                  className="csc-link mt-3 text-sm"
                >
                  Next: {slideLabel(slides[index + 1])}
                </button>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
