"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { CopyBlock, PitchSlide } from "@/app/sobeca-song-garden/content";
import { DEFAULT_COPY_COLOR } from "@/lib/sobeca-pitch/copy";
import { PHOTO_LIBRARY } from "@/lib/pitches/photo-library";
import { plainPitchText, toggleBoldMarkup } from "@/lib/pitches/rich-text";
import { SOBECA_PITCH_ID } from "@/lib/pitches/model";
import { pitchDraftKey, shouldApplySavedDraft } from "@/lib/pitches/autosave";
import {
  addListBlock,
  addListItem,
  addTableBlock,
  addTableRow,
  addTextBlock,
  insertSlide,
  moveBlock,
  moveSlide,
  removeBlock,
  removeListItem,
  removeSlide,
  removeTableRow,
  type SlideEdit,
} from "@/lib/pitches/structure";
import { GradedPhoto } from "@/components/pitch/GradedPhoto";
import { SALMON_OVERLAY_COLOR } from "@/lib/pitches/photo-overlay";
import PitchOrgField from "@/components/settings/PitchOrgField";
import { SettingsButton } from "@/components/settings/ui";

type PitchPayload = {
  id: string;
  name: string;
  prompt: string;
  live: boolean;
  protected: boolean;
  href: string;
  builtin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  slides: PitchSlide[];
};

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
  heading2: "Heading 2",
  heading3: "Heading 3",
  line: "Line",
  paragraph: "Paragraph",
};

const TEXT_STYLES = ["title", "heading", "heading2", "heading3", "kicker", "line", "paragraph"] as const;

function RoundButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className="csc-btn-circle shrink-0 text-sm disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BlockOrder({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <RoundButton label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}>
        ↑
      </RoundButton>
      <RoundButton label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
        ↓
      </RoundButton>
      <RoundButton
        label={count <= 1 ? "A slide needs at least one block" : `Delete ${label}`}
        disabled={count <= 1}
        onClick={onRemove}
      >
        ×
      </RoundButton>
    </span>
  );
}

function FitText({
  value,
  onChange,
  label,
  styleName,
  onStyle,
  bold = false,
  onToggleBold,
  rule = false,
  onToggleRule,
  nextClick = false,
  onNextClick,
  tools,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  styleName?: string;
  onStyle?: (style: (typeof TEXT_STYLES)[number]) => void;
  bold?: boolean;
  onToggleBold?: () => void;
  rule?: boolean;
  onToggleRule?: () => void;
  nextClick?: boolean;
  onNextClick?: () => void;
  tools?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function applyBold() {
    const el = ref.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    if (el && start !== end) {
      const next = toggleBoldMarkup(value, start, end);
      onChange(next.value);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.start, next.end);
      });
      return;
    }
    onToggleBold?.();
  }

  return (
    <label className="block border-b border-[var(--csc-row-divider)] py-2">
      <span className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">{label}</span>
        <span className="flex items-center gap-2">
          {onStyle && styleName ? (
            <select
              aria-label={`${label} font style`}
              value={styleName}
              onChange={(event) => {
                const next = event.target.value;
                if ((TEXT_STYLES as readonly string[]).includes(next)) onStyle(next as (typeof TEXT_STYLES)[number]);
              }}
              className="bg-black text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--csc-accent)] focus:outline-none"
            >
              <option value="title">Title</option>
              <option value="heading">Heading</option>
              <option value="heading2">Heading 2</option>
              <option value="heading3">Heading 3</option>
              <option value="kicker">Kicker</option>
              <option value="line">Line</option>
              <option value="paragraph">Paragraph</option>
            </select>
          ) : null}
          {onToggleRule ? (
            <button
              type="button"
              aria-pressed={rule}
              aria-label={`Lime vertical line on ${label}`}
              title="Lime vertical line beside the first line"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onToggleRule}
              className={`text-[10px] uppercase tracking-[0.16em] ${
                rule ? "border border-[var(--csc-accent)] px-1.5 font-bold text-white" : "font-semibold text-[var(--csc-accent)]"
              }`}
            >
              Bar
            </button>
          ) : null}
          {onNextClick ? (
            <button
              type="button"
              aria-pressed={nextClick}
              aria-label={`Put ${label} at the bottom on the next click`}
              title="Put this text at the bottom on the next click"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onNextClick}
              className={`text-[10px] uppercase tracking-[0.16em] ${
                nextClick ? "border border-[var(--csc-accent)] px-1.5 font-bold text-white" : "font-semibold text-[var(--csc-accent)]"
              }`}
            >
              Next click
            </button>
          ) : null}
          {onStyle ? (
            <button
              type="button"
              aria-pressed={bold}
              aria-label={`Bold ${label}`}
              title="Bold the line, or the selected words"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyBold}
              className={`text-[10px] uppercase tracking-[0.16em] ${
                bold ? "border border-[var(--csc-accent)] px-1.5 font-bold text-white" : "font-semibold text-[var(--csc-accent)]"
              }`}
            >
              Bold
            </button>
          ) : null}
          {tools}
        </span>
      </span>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full resize-none bg-transparent leading-snug text-white focus:outline-none ${
          styleName === "heading3" ? "font-mono text-base" : "text-sm"
        } ${bold ? "font-bold" : ""}`}
      />
    </label>
  );
}

export default function PitchEditor({ id }: { id: string }) {
  const [pitch, setPitch] = useState<PitchPayload | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [slides, setSlides] = useState<PitchSlide[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pagePassword, setPagePassword] = useState("");
  const [passwordOn, setPasswordOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [live, setLive] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const slidesRef = useRef<PitchSlide[] | null>(null);
  const nameRef = useRef("");
  const promptRef = useRef("");
  const savedKey = useRef<string | null>(null);
  const saveGeneration = useRef(0);
  const saveAbort = useRef<AbortController | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveDraftRef = useRef<(reset: boolean) => Promise<void>>(async () => {});
  slidesRef.current = slides;
  nameRef.current = name;
  promptRef.current = prompt;

  function currentDraftKey() {
    const currentSlides = slidesRef.current;
    if (!currentSlides) return null;
    return pitchDraftKey({ name: nameRef.current, prompt: promptRef.current, slides: currentSlides });
  }

  function applyPitch(next: PitchPayload, message: string) {
    savedKey.current = pitchDraftKey({ name: next.name, prompt: next.prompt, slides: next.slides });
    setPitch(next);
    setName(next.name);
    setPrompt(next.prompt);
    setSlides(next.slides);
    setLive(next.live);
    setOrganizationId(next.organizationId ?? null);
    setOrganizationName(next.organizationName ?? null);
    setActiveId((current) => (next.slides.some((slide) => slide.id === current) ? current : next.slides[0]?.id ?? null));
    setStatus(message);
  }

  function queueSave(delay: number) {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveDraftRef.current(false);
    }, delay);
  }

  async function saveDraft(reset: boolean) {
    const currentSlides = slidesRef.current;
    if (!currentSlides) return;
    const sentKey = pitchDraftKey({ name: nameRef.current, prompt: promptRef.current, slides: currentSlides });
    if (!reset && sentKey === savedKey.current) return;
    saveAbort.current?.abort();
    const controller = new AbortController();
    saveAbort.current = controller;
    const generation = ++saveGeneration.current;
    if (!reset) setStatus("Saving…");
    try {
      const res = await fetch(`/api/pitches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reset
            ? { reset: true, name: nameRef.current, prompt: promptRef.current }
            : { slides: currentSlides, name: nameRef.current, prompt: promptRef.current }
        ),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (generation !== saveGeneration.current) return;
      const next = data.pitch as PitchPayload;
      const latestKey = currentDraftKey();
      if (!reset && (latestKey === null || !shouldApplySavedDraft(latestKey, sentKey))) {
        queueSave(200);
        return;
      }
      applyPitch(next, reset ? "Reset." : "Saved.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (generation !== saveGeneration.current) return;
      setStatus(err instanceof Error ? err.message : "Save failed");
    }
  }
  saveDraftRef.current = saveDraft;

  useEffect(() => {
    let cancelled = false;
    savedKey.current = null;
    fetch(`/api/pitches/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load the pitch");
        const next = data.pitch as PitchPayload;
        if (cancelled) return;
        savedKey.current = pitchDraftKey({ name: next.name, prompt: next.prompt, slides: next.slides });
        setPitch(next);
        setName(next.name);
        setPrompt(next.prompt);
        setSlides(next.slides);
        setLive(next.live);
        setPasswordOn(next.protected);
        setOrganizationId(next.organizationId ?? null);
        setOrganizationName(next.organizationName ?? null);
        setActiveId(next.slides?.[0]?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Could not load the pitch");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!slides || savedKey.current === null) return;
    const key = pitchDraftKey({ name, prompt, slides });
    if (key === savedKey.current) return;
    queueSave(600);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [name, prompt, slides]);

  useEffect(() => {
    const flush = () => {
      const currentSlides = slidesRef.current;
      if (!currentSlides || savedKey.current === null) return;
      const key = pitchDraftKey({ name: nameRef.current, prompt: promptRef.current, slides: currentSlides });
      if (key === savedKey.current) return;
      saveAbort.current?.abort();
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void fetch(`/api/pitches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: currentSlides, name: nameRef.current, prompt: promptRef.current }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [id]);

  async function toggleLive() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/pitches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live: !live }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the page");
      setLive(Boolean(data.pitch?.live));
      setStatus(data.pitch?.live ? "This pitch is live." : "This pitch is hidden.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not update the page");
    } finally {
      setSaving(false);
    }
  }

  async function replaceMedia(slide: PitchSlide, file: File, kind: "image" | "video") {
    setUploadingId(slide.id);
    setStatus(null);
    try {
      const prepared = await fetch(`/api/pitches/${id}/background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId: slide.id,
          name: file.name,
          contentType: file.type,
          size: file.size,
          kind,
        }),
      });
      const prep = await prepared.json();
      if (!prepared.ok) throw new Error(prep.error ?? "Could not prepare upload");
      const put = await fetch(prep.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": prep.upload.contentType },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      const url = prep.upload.publicUrl as string;
      const next = (slidesRef.current ?? []).map((item) => {
        if (item.id !== slide.id) return item;
        if (kind === "video") return { ...item, video: url };
        return { ...item, image: url };
      });
      slidesRef.current = next;
      setSlides(next);
      setStatus(kind === "video" ? "Video uploaded." : null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  if (!slides || !pitch) {
    return <p className="text-sm text-white/70">{status ?? "Loading pitch…"}</p>;
  }

  const deck = slides;
  const structureOpen = pitch.id !== SOBECA_PITCH_ID;

  function jump(sectionId: string) {
    setActiveId(sectionId);
    document.getElementById(`pitch-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function patchSlide(sectionId: string, recipe: (slide: PitchSlide) => PitchSlide) {
    setSlides((current) => {
      const next = current?.map((item) => (item.id === sectionId ? recipe(item) : item)) ?? current;
      slidesRef.current = next;
      return next;
    });
    setStatus(null);
  }

  function commit(result: SlideEdit) {
    if ("error" in result) {
      setStatus(result.error);
      return null;
    }
    slidesRef.current = result.slides;
    setSlides(result.slides);
    setStatus(null);
    return result;
  }

  function addSlide(afterId: string | null) {
    const current = slidesRef.current ?? deck;
    const result = commit(insertSlide(current, afterId));
    if (!result?.id) return;
    setActiveId(result.id);
    window.setTimeout(() => {
      document.getElementById(`pitch-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function deleteSlide(slide: PitchSlide, index: number) {
    const current = slidesRef.current ?? deck;
    if (current.length <= 1) return;
    const label = slideLabel(slide).trim().slice(0, 80) || `Slide ${index + 1}`;
    if (!window.confirm(`Delete slide ${index + 1}, "${label}"?`)) return;
    const neighbor = current[index + 1]?.id ?? current[index - 1]?.id ?? null;
    if (commit(removeSlide(current, slide.id))) setActiveId(neighbor);
  }

  function revealBlock(slideId: string, blockIndex: number) {
    window.setTimeout(() => {
      document.getElementById(`block-${slideId}-${blockIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  return (
    <div>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-[var(--csc-row-divider)] bg-black py-3">
        <SettingsButton
          variant="primary"
          disabled={saving}
          onClick={() => {
            if (saveTimer.current !== null) {
              window.clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            void saveDraft(false);
          }}
        >
          Save
        </SettingsButton>
        <SettingsButton
          disabled={saving}
          title={pitch.builtin ? "Return to the original deck" : "Rebuild the sections from the prompt"}
          onClick={() => {
            if (saveTimer.current !== null) {
              window.clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            void saveDraft(true);
          }}
        >
          Reset
        </SettingsButton>
        <SettingsButton href={pitch.href} target="_blank">
          View
        </SettingsButton>
        <SettingsButton variant={live ? "primary" : "ghost"} disabled={saving} onClick={() => void toggleLive()}>
          {live ? "Live" : "Hidden"}
        </SettingsButton>
        <SettingsButton onClick={() => setShowPassword((open) => !open)}>
          {passwordOn ? "Password on" : "Password"}
        </SettingsButton>
        {status ? <p className="text-sm text-white/70">{status}</p> : null}
      </div>

      <PitchOrgField
        pitchId={pitch.id}
        organizationId={organizationId}
        organizationName={organizationName}
        onAssigned={(next) => {
          setOrganizationId(next.organizationId);
          setOrganizationName(next.organizationName);
        }}
      />

      <details className="border-b border-[var(--csc-row-divider)]">
        <summary className="cursor-pointer py-3 text-sm text-white">Brief</summary>
        <label className="block border-b border-[var(--csc-row-divider)] py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Internal name</span>
          <input
            value={name}
            aria-label="Internal name"
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full bg-transparent text-sm text-white focus:outline-none"
          />
        </label>
        <label className="block py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">Prompt</span>
          <textarea
            value={prompt}
            rows={3}
            aria-label="Prompt"
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-1 w-full resize-y bg-transparent text-sm leading-relaxed text-white focus:outline-none"
          />
        </label>
      </details>

      {showPassword ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-[var(--csc-row-divider)] py-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setStatus(null);
            try {
              const res = await fetch(`/api/pitches/${id}/access`, {
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
                  const res = await fetch(`/api/pitches/${id}/access`, {
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
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {slides.map((item, index) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                className={`shrink-0 border px-3 py-1.5 text-xs ${
                  selected ? "border-[var(--csc-accent)] text-[var(--csc-accent)]" : "border-white/15 text-white"
                }`}
              >
                {index + 1}. {slideLabel(item)}
              </button>
            );
          })}
          {structureOpen ? (
            <SettingsButton onClick={() => addSlide(null)}>Add slide</SettingsButton>
          ) : null}
        </div>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <div className="sticky top-4 hidden max-h-[calc(100dvh-8rem)] lg:flex lg:flex-col">
          <nav className="csc-list min-h-0 overflow-y-auto">
            {slides.map((item, index) => {
              const selected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => jump(item.id)}
                  className="csc-list-row w-full text-left"
                  aria-current={selected ? "true" : undefined}
                  style={selected ? { outlineColor: "var(--csc-accent)" } : undefined}
                >
                  <span className="w-5 shrink-0 text-xs text-white/50">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{slideLabel(item)}</span>
                </button>
              );
            })}
          </nav>
          {structureOpen ? (
            <div className="pt-3">
              <SettingsButton onClick={() => addSlide(null)}>Add slide</SettingsButton>
            </div>
          ) : null}
        </div>

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

              <label className="mt-3 block border-b border-[var(--csc-row-divider)] pb-3">
                <span className="csc-eyebrow">Next click</span>
                <textarea
                  rows={2}
                  value={slide.bottom ?? ""}
                  aria-label={`Text at the bottom of slide ${index + 1} on the next click`}
                  placeholder="Shown at the bottom on the next click"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchSlide(slide.id, (current) => ({ ...current, bottom: value ? value : undefined }));
                  }}
                  className="mt-1 w-full resize-y bg-transparent text-sm leading-snug text-white focus:outline-none"
                />
              </label>

              {structureOpen ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <SettingsButton
                    variant={slide.reveal === "steps" ? "ghost" : "primary"}
                    title="Every line is on the slide. One extra click still holds the last line."
                    onClick={() => patchSlide(slide.id, (current) => ({ ...current, reveal: undefined }))}
                  >
                    All at once
                  </SettingsButton>
                  <SettingsButton
                    variant={slide.reveal === "steps" ? "primary" : "ghost"}
                    title="Each click brings in the next line, bullet, or row."
                    onClick={() => patchSlide(slide.id, (current) => ({ ...current, reveal: "steps" }))}
                  >
                    One at a time
                  </SettingsButton>
                  <SettingsButton
                    onClick={() => {
                      const result = commit(addTextBlock(slidesRef.current ?? deck, slide.id));
                      const count = result?.slides.find((item) => item.id === slide.id)?.blocks.length ?? 0;
                      if (count) revealBlock(slide.id, count - 1);
                    }}
                  >
                    Add text
                  </SettingsButton>
                  <SettingsButton
                    onClick={() => {
                      const result = commit(addTextBlock(slidesRef.current ?? deck, slide.id, "heading2"));
                      const count = result?.slides.find((item) => item.id === slide.id)?.blocks.length ?? 0;
                      if (count) revealBlock(slide.id, count - 1);
                    }}
                  >
                    Add heading 2
                  </SettingsButton>
                  <SettingsButton
                    onClick={() => {
                      const result = commit(addTextBlock(slidesRef.current ?? deck, slide.id, "heading3"));
                      const count = result?.slides.find((item) => item.id === slide.id)?.blocks.length ?? 0;
                      if (count) revealBlock(slide.id, count - 1);
                    }}
                  >
                    Add heading 3
                  </SettingsButton>
                  <SettingsButton
                    onClick={() => {
                      const result = commit(addListBlock(slidesRef.current ?? deck, slide.id));
                      const count = result?.slides.find((item) => item.id === slide.id)?.blocks.length ?? 0;
                      if (count) revealBlock(slide.id, count - 1);
                    }}
                  >
                    Add list
                  </SettingsButton>
                  <SettingsButton
                    onClick={() => {
                      const result = commit(addTableBlock(slidesRef.current ?? deck, slide.id));
                      const count = result?.slides.find((item) => item.id === slide.id)?.blocks.length ?? 0;
                      if (count) revealBlock(slide.id, count - 1);
                    }}
                  >
                    Add table
                  </SettingsButton>
                  <SettingsButton onClick={() => addSlide(slide.id)}>Add slide</SettingsButton>
                  <SettingsButton disabled={index === 0} onClick={() => commit(moveSlide(slidesRef.current ?? deck, slide.id, -1))}>
                    Move up
                  </SettingsButton>
                  <SettingsButton
                    disabled={index === deck.length - 1}
                    onClick={() => commit(moveSlide(slidesRef.current ?? deck, slide.id, 1))}
                  >
                    Move down
                  </SettingsButton>
                  <SettingsButton
                    variant="danger"
                    disabled={deck.length < 2}
                    title={deck.length < 2 ? "A pitch needs at least one slide." : "Delete this slide"}
                    onClick={() => deleteSlide(slide, index)}
                  >
                    Delete slide
                  </SettingsButton>
                </div>
              ) : null}

              <div className="relative mt-3">
                <div className="relative h-28 w-full overflow-hidden bg-black">
                  <GradedPhoto
                    src={slide.image}
                    alt=""
                    overlay={slide.photoOverlay}
                    amount={slide.photoOverlayAmount ?? 1}
                    color={slide.photoOverlayColor}
                    className="h-full w-full"
                  />
                  {slide.video ? (
                    <video
                      key={slide.video}
                      className="absolute inset-0 h-full w-full object-cover"
                      src={slide.video}
                      poster={slide.image}
                      muted
                      playsInline
                      autoPlay
                      loop
                      preload="metadata"
                      aria-label="Slide background video preview"
                    />
                  ) : null}
                </div>
                <div className="absolute bottom-2 right-2 z-10 flex flex-wrap justify-end gap-1">
                  <label className="csc-link bg-black/70 px-2 py-1 text-xs">
                    {uploadingId === slide.id ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploadingId !== null || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void replaceMedia(slide, file, "image");
                      }}
                    />
                  </label>
                  <label className="csc-link bg-black/70 px-2 py-1 text-xs">
                    {uploadingId === slide.id ? "Uploading…" : slide.video ? "Replace video" : "Upload video"}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      disabled={uploadingId !== null || saving}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void replaceMedia(slide, file, "video");
                      }}
                    />
                  </label>
                  {slide.video ? (
                    <button
                      type="button"
                      className="csc-link bg-black/70 px-2 py-1 text-xs"
                      disabled={uploadingId !== null || saving}
                      onClick={() => patchSlide(slide.id, (current) => ({ ...current, video: undefined }))}
                    >
                      Remove video
                    </button>
                  ) : null}
                </div>
              </div>
              {structureOpen ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="csc-eyebrow">Color overlay</span>
                  <SettingsButton
                    variant={slide.photoOverlay === "salmon" ? "ghost" : "primary"}
                    title="Leave the photo as it was shot."
                    onClick={() => patchSlide(slide.id, (current) => ({ ...current, photoOverlay: undefined }))}
                  >
                    None
                  </SettingsButton>
                  <SettingsButton
                    variant={slide.photoOverlay === "salmon" ? "primary" : "ghost"}
                    title="Pink grade so this photo matches the salmon library photos."
                    onClick={() => patchSlide(slide.id, (current) => ({ ...current, photoOverlay: "salmon" }))}
                  >
                    Salmon
                  </SettingsButton>
                </div>
              ) : null}
              {structureOpen && slide.photoOverlay === "salmon" ? (
                <label className="mt-3 flex max-w-md items-center gap-3">
                  <span className="csc-eyebrow shrink-0">
                    Transparency {Math.round((1 - (slide.photoOverlayAmount ?? 1)) * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Overlay transparency"
                    title="0% is the full color. 100% shows the photo as it was shot."
                    value={Math.round((1 - (slide.photoOverlayAmount ?? 1)) * 100)}
                    onChange={(event) => {
                      const transparency = Number(event.target.value) / 100;
                      patchSlide(slide.id, (current) => ({
                        ...current,
                        photoOverlayAmount: Math.round((1 - transparency) * 100) / 100,
                      }));
                    }}
                    className="w-full accent-[var(--csc-accent)]"
                  />
                  <span className="csc-eyebrow shrink-0">Color</span>
                  <input
                    type="color"
                    aria-label="Overlay color"
                    title="Color of the photo grade"
                    value={slide.photoOverlayColor || SALMON_OVERLAY_COLOR}
                    className="h-6 w-8 cursor-pointer bg-transparent"
                    onChange={(event) =>
                      patchSlide(slide.id, (current) => ({
                        ...current,
                        photoOverlayColor: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                  <span className="font-mono text-xs text-white/70">{slide.photoOverlayColor || SALMON_OVERLAY_COLOR}</span>
                </label>
              ) : null}
              <p className="csc-eyebrow mt-3">Library</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {PHOTO_LIBRARY.map((photo) => {
                  const selected = slide.image === photo.src;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      aria-label={`Use ${photo.alt}`}
                      aria-pressed={selected}
                      className="h-16 w-24 shrink-0 overflow-hidden border-2"
                      style={{ borderColor: selected ? "var(--csc-accent)" : "transparent" }}
                      onClick={() =>
                        patchSlide(slide.id, (current) => ({
                          ...current,
                          image: photo.src,
                          imageAlt: photo.alt,
                          video: undefined,
                        }))
                      }
                    >
                      <GradedPhoto
                        src={photo.src}
                        alt=""
                        overlay={slide.photoOverlay}
                        amount={slide.photoOverlayAmount ?? 1}
                        color={slide.photoOverlayColor}
                        className="h-full w-full"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-2">
                {slide.blocks.map((block, blockIndex) => {
                  const order = structureOpen ? (
                    <BlockOrder
                      label={(BLOCK_LABEL[block.type] ?? block.type).toLowerCase()}
                      index={blockIndex}
                      count={slide.blocks.length}
                      onMove={(direction) => commit(moveBlock(slidesRef.current ?? deck, slide.id, blockIndex, direction))}
                      onRemove={() => commit(removeBlock(slidesRef.current ?? deck, slide.id, blockIndex))}
                    />
                  ) : null;

                  if (block.type === "image") {
                    if (!structureOpen) return null;
                    return (
                      <div
                        key={blockIndex}
                        id={`block-${slide.id}-${blockIndex}`}
                        className="flex items-center justify-between gap-3 border-b border-[var(--csc-row-divider)] py-2"
                      >
                        <span className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
                            Image
                          </span>
                          <span className="mt-1 block truncate text-sm text-white">{block.alt}</span>
                        </span>
                        {order}
                      </div>
                    );
                  }
                  if (block.type === "list") {
                    return (
                      <div key={blockIndex} id={`block-${slide.id}-${blockIndex}`} className="border-b border-[var(--csc-row-divider)] py-2">
                        <span className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
                            List
                          </span>
                          {order}
                        </span>
                        {block.items.map((item, itemIndex) => (
                          <FitText
                            key={itemIndex}
                            label={`Item ${itemIndex + 1}`}
                            value={item}
                            nextClick={slide.bottom?.trim() === item.trim() && item.trim().length > 0}
                            onNextClick={() => {
                              const plain = item.trim();
                              if (!plain) return;
                              patchSlide(slide.id, (current) => ({
                                ...current,
                                bottom: current.bottom?.trim() === plain ? undefined : plain,
                              }));
                            }}
                            tools={
                              structureOpen && block.items.length > 1 ? (
                                <RoundButton
                                  label={`Delete item ${itemIndex + 1}`}
                                  onClick={() => commit(removeListItem(slidesRef.current ?? deck, slide.id, blockIndex, itemIndex))}
                                >
                                  ×
                                </RoundButton>
                              ) : undefined
                            }
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
                        {structureOpen ? (
                          <div className="pt-2">
                            <SettingsButton onClick={() => commit(addListItem(slidesRef.current ?? deck, slide.id, blockIndex))}>
                              Add line
                            </SettingsButton>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  if (block.type === "table") {
                    const columns =
                      block.headers.length === 2
                        ? "grid gap-x-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]"
                        : "grid gap-x-4";
                    const columnStyle =
                      block.headers.length === 2
                        ? undefined
                        : { gridTemplateColumns: `repeat(${Math.max(block.headers.length, 1)}, minmax(0, 1fr))` };
                    return (
                      <div key={blockIndex} id={`block-${slide.id}-${blockIndex}`} className="mt-2">
                        <span className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--csc-accent)]">
                            Table
                          </span>
                          {order}
                        </span>
                        <div className={columns} style={columnStyle}>
                          {block.headers.map((header, headerIndex) => (
                            <FitText
                              key={`header-${headerIndex}`}
                              label={`Header ${headerIndex + 1}`}
                              value={header}
                              onChange={(value) =>
                                patchSlide(slide.id, (current) => {
                                  const existing = current.blocks[blockIndex];
                                  if (existing?.type !== "table") return current;
                                  const headers = existing.headers.slice();
                                  headers[headerIndex] = value;
                                  return updateBlock(current, blockIndex, { ...existing, headers });
                                })
                              }
                            />
                          ))}
                        </div>
                        {block.rows.map((row, rowIndex) => (
                          <div key={rowIndex} className="flex items-start gap-2">
                            <div className={`min-w-0 flex-1 ${columns}`} style={columnStyle}>
                              {row.map((cell, cellIndex) => (
                                <FitText
                                  key={cellIndex}
                                  label={block.headers[cellIndex]?.trim() || `Column ${cellIndex + 1}`}
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
                            {structureOpen && block.rows.length > 1 ? (
                              <div className="pt-2">
                                <RoundButton
                                  label={`Delete row ${rowIndex + 1}`}
                                  onClick={() => commit(removeTableRow(slidesRef.current ?? deck, slide.id, blockIndex, rowIndex))}
                                >
                                  ×
                                </RoundButton>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {structureOpen ? (
                          <div className="pt-2">
                            <SettingsButton onClick={() => commit(addTableRow(slidesRef.current ?? deck, slide.id, blockIndex))}>
                              Add row
                            </SettingsButton>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <div key={blockIndex} id={`block-${slide.id}-${blockIndex}`}>
                      <FitText
                        label={BLOCK_LABEL[block.type] ?? block.type}
                        styleName={block.type}
                        bold={block.bold === true}
                        nextClick={
                          slide.bottom?.trim() === plainPitchText(block.text).trim() && plainPitchText(block.text).trim().length > 0
                        }
                        onNextClick={() => {
                          const plain = plainPitchText(block.text).trim();
                          if (!plain) return;
                          patchSlide(slide.id, (current) => ({
                            ...current,
                            bottom: current.bottom?.trim() === plain ? undefined : plain,
                          }));
                        }}
                        rule={block.type === "paragraph" && block.rule === true}
                        onToggleRule={
                          block.type === "paragraph"
                            ? () =>
                                patchSlide(slide.id, (current) => {
                                  const existing = current.blocks[blockIndex];
                                  if (existing?.type !== "paragraph") return current;
                                  return updateBlock(current, blockIndex, {
                                    ...existing,
                                    rule: existing.rule ? undefined : true,
                                  });
                                })
                            : undefined
                        }
                        tools={order}
                        value={block.text}
                        onToggleBold={() =>
                          patchSlide(slide.id, (current) => {
                            const existing = current.blocks[blockIndex];
                            if (!existing || !("text" in existing)) return current;
                            return updateBlock(current, blockIndex, { ...existing, bold: existing.bold ? undefined : true });
                          })
                        }
                        onStyle={(style) =>
                          patchSlide(slide.id, (current) => {
                            const existing = current.blocks[blockIndex];
                            if (!existing || !("text" in existing)) return current;
                            return updateBlock(current, blockIndex, {
                              type: style,
                              text: existing.text,
                              ...(existing.bold ? { bold: true } : {}),
                              ...(style === "paragraph" && existing.type === "paragraph" && existing.rule
                                ? { rule: true }
                                : {}),
                            });
                          })
                        }
                        onChange={(value) =>
                          patchSlide(slide.id, (current) => {
                            const existing = current.blocks[blockIndex];
                            if (!existing || !("text" in existing)) return current;
                            return updateBlock(current, blockIndex, { ...existing, text: value });
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>

              {index < deck.length - 1 ? (
                <button type="button" onClick={() => jump(deck[index + 1].id)} className="csc-link mt-3 text-sm">
                  Next: {slideLabel(deck[index + 1])}
                </button>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
