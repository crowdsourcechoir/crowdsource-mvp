"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { insertBlock, moveBlock } from "@/lib/marketing/editor/block-order";
import { newSection, sectionLabel, SECTION_LABELS } from "@/lib/marketing/editor/sections";
import type { EmailSection, SectionType } from "@/lib/marketing/document/types";
import type { EmailDesignTokens, EmailTypeStyle } from "@/lib/marketing/render/tokens";
import InlineTextEditor from "@/components/marketing/editor/InlineTextEditor";
import Inspector from "@/components/marketing/editor/Inspector";

type EventOption = { id: string; title: string; slug: string; date: string; venue: string };
type DragPayload = { kind: "new"; type: SectionType } | { kind: "move"; id: string };

function paint(tokens: EmailDesignTokens, section: EmailSection): { background: string; color: string } {
  if (section.background === "surface") return { background: tokens.colors.surface, color: tokens.colors.ink };
  if (section.background === "brand") return { background: tokens.colors.brand, color: tokens.colors.brandInk };
  if (section.background === "ink") return { background: tokens.colors.ink, color: tokens.colors.canvas };
  if (section.background === "custom" && /^#[0-9a-fA-F]{6}$/.test(section.customBackground ?? "")) {
    return { background: section.customBackground ?? tokens.colors.canvas, color: tokens.colors.ink };
  }
  return { background: tokens.colors.canvas, color: tokens.colors.ink };
}

function fieldStyle(color: string, font: string, size: number, weight = 400): CSSProperties {
  return {
    width: "100%",
    background: "transparent",
    border: "none",
    color,
    fontFamily: font,
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1.35,
    outline: "none",
    padding: 0,
    resize: "vertical",
  };
}

function displayStyle(color: string, font: string, style: EmailTypeStyle): CSSProperties {
  return {
    ...fieldStyle(color, font, style.size, style.weight),
    lineHeight: style.lineHeight,
    letterSpacing: style.tracking ? `${style.tracking}px` : undefined,
  };
}

function eyebrowStyle(tokens: EmailDesignTokens): CSSProperties {
  return {
    ...fieldStyle(tokens.colors.brand, tokens.fonts.ui, tokens.type.eyebrow.size, tokens.type.eyebrow.weight),
    letterSpacing: `${tokens.type.eyebrow.tracking ?? 3.4}px`,
    textTransform: "uppercase",
    lineHeight: tokens.type.eyebrow.lineHeight,
  };
}

function buttonStyle(tokens: EmailDesignTokens, outline: boolean): CSSProperties {
  return {
    ...fieldStyle(outline ? tokens.colors.brand : tokens.colors.brandInk, tokens.fonts.ui, tokens.button.fontSize, 700),
    background: outline ? "transparent" : tokens.colors.brand,
    color: outline ? tokens.colors.brand : tokens.colors.brandInk,
    border: outline ? `1px solid ${tokens.colors.brand}` : "none",
    borderRadius: tokens.radii.button,
    padding: `${tokens.button.paddingY}px ${tokens.button.paddingX}px`,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    width: "auto",
    textAlign: "center",
  };
}

export default function EmailEditor({
  sections,
  tokens,
  events,
  busy,
  onChange,
}: {
  sections: EmailSection[];
  tokens: EmailDesignTokens;
  events: EventOption[];
  busy: boolean;
  onChange: (sections: EmailSection[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null);
  const [dragging, setDragging] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragPayload = useRef<DragPayload | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const dragActive = useRef(false);
  const selected = sections.find((section) => section.id === selectedId) ?? null;
  const footerCount = sections.filter((section) => section.type === "footer").length;

  useEffect(() => {
    const id = "csc-email-house-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  function update(next: EmailSection) {
    onChange(sections.map((section) => (section.id === next.id ? next : section)));
  }

  function patch(section: EmailSection, props: Record<string, unknown>) {
    update({ ...section, props: { ...section.props, ...props } });
  }

  function markDrop(index: number) {
    dropIndexRef.current = index;
    setDropIndex((current) => (current === index ? current : index));
  }

  function clearDrag() {
    dragActive.current = false;
    dragPayload.current = null;
    dropIndexRef.current = null;
    setDragging(false);
    setDropIndex(null);
  }

  function dropAt(index: number) {
    const payload = dragPayload.current;
    clearDrag();
    if (!payload) return;
    const next =
      payload.kind === "new" ? insertBlock(sections, newSection(payload.type), index) : moveBlock(sections, payload.id, index);
    onChange(next);
    if (payload.kind === "new") setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
  }

  function beginDrag(event: DragEvent, payload: DragPayload) {
    dragActive.current = true;
    dragPayload.current = payload;
    event.dataTransfer.effectAllowed = payload.kind === "new" ? "copy" : "move";
    event.dataTransfer.setData("text/plain", payload.kind === "new" ? payload.type : payload.id);
    window.requestAnimationFrame(() => {
      if (dragActive.current) setDragging(true);
    });
  }

  function endDrag() {
    window.setTimeout(() => {
      if (!dragPayload.current) return;
      const index = dropIndexRef.current;
      if (index == null) clearDrag();
      else dropAt(index);
    }, 0);
  }

  function slotFromPointer(event: DragEvent<HTMLElement>, index: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY >= rect.top + rect.height / 2 ? index + 1 : index;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,640px)_280px]">
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {SECTION_LABELS.map((item) => (
            <button
              key={item.type}
              type="button"
              draggable={!busy}
              disabled={busy}
              data-section-type={item.type}
              onDragStart={(event) => beginDrag(event, { kind: "new", type: item.type })}
              onDragEnd={endDrag}
              className="inline-flex cursor-grab items-center justify-center rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-[var(--csc-accent)] active:cursor-grabbing disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="mx-auto overflow-hidden rounded-xl border border-[var(--csc-row-divider)]"
          style={{ maxWidth: tokens.emailWidth, background: tokens.colors.canvas }}
          onDragEnd={endDrag}
        >
          <div style={{ background: tokens.colors.canvas, padding: "28px 24px 8px", textAlign: "center" }}>
            <img src="/logo.png" alt="Crowdsource Choir" style={{ width: 220, height: "auto", margin: "0 auto" }} />
          </div>
          {sections.map((section, index) => (
            <div key={section.id}>
              <DropSlot
                index={index}
                active={dropIndex === index}
                dragging={dragging}
                empty={sections.length === 0}
                onOver={() => markDrop(index)}
                onDrop={() => dropAt(index)}
              />
              <article
                data-section-id={section.id}
                onClick={() => setSelectedId(section.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  markDrop(slotFromPointer(event, index));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dropAt(slotFromPointer(event, index));
                }}
                style={{
                  background: paint(tokens, section).background,
                  color: paint(tokens, section).color,
                  padding: `${tokens.spacing[section.spacing]}px 24px`,
                  textAlign: section.align,
                  outline: selectedId === section.id ? "1px solid var(--csc-accent)" : "1px solid transparent",
                }}
              >
                <button
                  type="button"
                  draggable={!busy}
                  title="Drag to move"
                  onDragStart={(event) => beginDrag(event, { kind: "move", id: section.id })}
                  onDragEnd={endDrag}
                  className="mb-3 cursor-grab text-left active:cursor-grabbing"
                  style={{
                    fontFamily: tokens.fonts.ui,
                    fontSize: tokens.type.eyebrow.size,
                    fontWeight: tokens.type.eyebrow.weight,
                    letterSpacing: `${tokens.type.eyebrow.tracking ?? 1.4}px`,
                    textTransform: "uppercase",
                    color: tokens.colors.brand,
                    background: "transparent",
                    border: "none",
                  }}
                >
                  {sectionLabel(section.type)}
                </button>
                <SectionFields section={section} tokens={tokens} color={paint(tokens, section).color} onPatch={(props) => patch(section, props)} />
              </article>
            </div>
          ))}
          <DropSlot
            index={sections.length}
            active={dropIndex === sections.length}
            dragging={dragging}
            empty={sections.length === 0}
            onOver={() => markDrop(sections.length)}
            onDrop={() => dropAt(sections.length)}
          />
        </div>
      </div>
      <aside className="rounded-xl border border-[var(--csc-row-divider)] p-4">
        <p className="csc-eyebrow">{selected ? sectionLabel(selected.type) : "Section"}</p>
        <div className="mt-4">
          <Inspector
            section={selected}
            events={events}
            onlyFooter={footerCount <= 1}
            onChange={update}
            onDuplicate={() => {
              if (!selected) return;
              const copy = { ...selected, id: `sec_${Date.now().toString(36)}`, props: { ...selected.props } };
              const index = sections.findIndex((section) => section.id === selected.id);
              onChange(insertBlock(sections, copy, index + 1));
              setSelectedId(copy.id);
            }}
            onRemove={() => {
              if (!selected) return;
              onChange(sections.filter((section) => section.id !== selected.id));
              setSelectedId(null);
            }}
          />
        </div>
      </aside>
    </div>
  );
}

function DropSlot({
  index,
  active,
  dragging,
  empty,
  onOver,
  onDrop,
}: {
  index: number;
  active: boolean;
  dragging: boolean;
  empty: boolean;
  onOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      data-drop-index={index}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
      className={`relative ${active ? "bg-[var(--csc-accent)]/20" : ""}`}
      style={{ height: empty ? 72 : dragging ? 36 : 8 }}
    >
      {active ? <div className="pointer-events-none absolute inset-x-3 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--csc-accent)]" /> : null}
      {empty ? <p className="pt-6 text-center text-xs uppercase tracking-[0.14em] text-gray-400">Drop a section here</p> : null}
    </div>
  );
}

function SectionFields({
  section,
  tokens,
  color,
  onPatch,
}: {
  section: EmailSection;
  tokens: EmailDesignTokens;
  color: string;
  onPatch: (props: Record<string, unknown>) => void;
}) {
  const text = (key: string) => (typeof section.props[key] === "string" ? String(section.props[key]) : "");
  const image = section.props.image;
  const imageUrl = image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string" ? (image as { url: string }).url : "";

  if (section.type === "hero") {
    return (
      <div className="space-y-2">
        {imageUrl ? <img src={imageUrl} alt="" className="mb-3 max-h-48 w-full object-cover" /> : null}
        <input value={text("eyebrow")} onChange={(event) => onPatch({ eyebrow: event.target.value })} placeholder="Eyebrow" style={eyebrowStyle(tokens)} />
        <input value={text("title")} onChange={(event) => onPatch({ title: event.target.value })} placeholder="Title" style={displayStyle(color, tokens.fonts.heading, tokens.type.title)} />
        <textarea value={text("subtitle")} onChange={(event) => onPatch({ subtitle: event.target.value })} placeholder="Subtitle" rows={2} style={fieldStyle(tokens.colors.muted, tokens.fonts.body, tokens.type.body.size)} />
        <input value={text("ctaLabel")} onChange={(event) => onPatch({ ctaLabel: event.target.value })} placeholder="Button label" style={buttonStyle(tokens, false)} />
        <input value={text("ctaHref")} onChange={(event) => onPatch({ ctaHref: event.target.value })} placeholder="https://" style={fieldStyle(tokens.colors.link, tokens.fonts.ui, 13)} />
      </div>
    );
  }
  if (section.type === "editorial_text") {
    return (
      <div className="space-y-2 text-left">
        <input value={text("heading")} onChange={(event) => onPatch({ heading: event.target.value })} placeholder="Heading" style={displayStyle(color, tokens.fonts.heading, tokens.type.heading)} />
        <InlineTextEditor
          key={section.id}
          value={section.props.body}
          color={color}
          fontFamily={tokens.fonts.body}
          fontSize={tokens.type.body.size}
          onChange={(body) => onPatch({ body, text: "" })}
        />
      </div>
    );
  }
  if (section.type === "large_statement") {
    return (
      <textarea value={text("text")} onChange={(event) => onPatch({ text: event.target.value })} placeholder="Statement" rows={3} style={displayStyle(color, tokens.fonts.heading, tokens.type.statement)} />
    );
  }
  if (section.type === "pull_quote") {
    return (
      <div className="space-y-2">
        <textarea value={text("quote")} onChange={(event) => onPatch({ quote: event.target.value })} placeholder="Quote" rows={3} style={displayStyle(tokens.colors.brand, tokens.fonts.heading, tokens.type.statement)} />
        <input value={text("attribution")} onChange={(event) => onPatch({ attribution: event.target.value })} placeholder="Attribution" style={eyebrowStyle(tokens)} />
      </div>
    );
  }
  if (section.type === "two_column") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnFields heading={text("leftHeading")} body={text("leftText")} tokens={tokens} color={color} onHeading={(leftHeading) => onPatch({ leftHeading })} onBody={(leftText) => onPatch({ leftText })} />
        <ColumnFields heading={text("rightHeading")} body={text("rightText")} tokens={tokens} color={color} onHeading={(rightHeading) => onPatch({ rightHeading })} onBody={(rightText) => onPatch({ rightText })} />
      </div>
    );
  }
  if (section.type === "full_bleed_image" || section.type === "gallery") {
    const images = section.type === "gallery" && Array.isArray(section.props.images) ? section.props.images : [];
    const urls = section.type === "gallery" ? images.flatMap((item) => (item && typeof item === "object" && typeof (item as { url?: string }).url === "string" ? [(item as { url: string }).url] : [])) : imageUrl ? [imageUrl] : [];
    return urls.length ? (
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url) => (
          <img key={url} src={url} alt="" className="aspect-square w-full object-cover" />
        ))}
      </div>
    ) : (
      <p style={fieldStyle(tokens.colors.muted, tokens.fonts.body, tokens.type.small.size)}>Add an image in the inspector.</p>
    );
  }
  if (section.type === "image_story" || section.type === "song_garden_invitation" || section.type === "artist_feature") {
    return (
      <div className="space-y-2">
        {imageUrl ? <img src={imageUrl} alt="" className="mb-3 max-h-40 w-full object-cover" /> : null}
        <input
          value={text(section.type === "artist_feature" ? "name" : "heading")}
          onChange={(event) => onPatch(section.type === "artist_feature" ? { name: event.target.value } : { heading: event.target.value })}
          placeholder={section.type === "artist_feature" ? "Name" : "Heading"}
          style={displayStyle(color, tokens.fonts.heading, tokens.type.heading)}
        />
        {section.type === "artist_feature" ? (
          <input value={text("role")} onChange={(event) => onPatch({ role: event.target.value })} placeholder="Role" style={fieldStyle(tokens.colors.muted, tokens.fonts.ui, tokens.type.small.size)} />
        ) : null}
        <textarea
          value={text(section.type === "artist_feature" ? "bio" : "text")}
          onChange={(event) => onPatch(section.type === "artist_feature" ? { bio: event.target.value } : { text: event.target.value })}
          placeholder="Body"
          rows={3}
          style={fieldStyle(color, tokens.fonts.body, tokens.type.body.size)}
        />
        {section.type !== "artist_feature" ? (
          <input value={text("ctaLabel")} onChange={(event) => onPatch({ ctaLabel: event.target.value })} placeholder="Button label" style={buttonStyle(tokens, false)} />
        ) : (
          <input value={text("href")} onChange={(event) => onPatch({ href: event.target.value })} placeholder="https://" style={fieldStyle(tokens.colors.link, tokens.fonts.ui, 13)} />
        )}
        {section.type !== "artist_feature" ? (
          <input value={text("ctaHref")} onChange={(event) => onPatch({ ctaHref: event.target.value })} placeholder="https://" style={fieldStyle(tokens.colors.link, tokens.fonts.ui, 13)} />
        ) : null}
      </div>
    );
  }
  if (section.type === "cta") {
    return (
      <div className="space-y-2">
        <input value={text("label")} onChange={(event) => onPatch({ label: event.target.value })} placeholder="Button label" style={buttonStyle(tokens, section.props.style === "outline")} />
        <input value={text("href")} onChange={(event) => onPatch({ href: event.target.value })} placeholder="https://" style={fieldStyle(tokens.colors.link, tokens.fonts.ui, 13)} />
      </div>
    );
  }
  if (section.type === "event") {
    return (
      <div className="space-y-2">
        <input value={text("title")} onChange={(event) => onPatch({ title: event.target.value })} placeholder="Event title" style={displayStyle(color, tokens.fonts.heading, tokens.type.heading)} />
        <input value={text("date")} onChange={(event) => onPatch({ date: event.target.value })} placeholder="Date" style={fieldStyle(tokens.colors.muted, tokens.fonts.body, tokens.type.small.size)} />
        <input value={text("venue")} onChange={(event) => onPatch({ venue: event.target.value })} placeholder="Venue" style={fieldStyle(color, tokens.fonts.body, tokens.type.body.size)} />
        <textarea value={text("description")} onChange={(event) => onPatch({ description: event.target.value })} placeholder="Description" rows={2} style={fieldStyle(color, tokens.fonts.body, tokens.type.body.size)} />
      </div>
    );
  }
  if (section.type === "footer") {
    return (
      <div className="space-y-2">
        <input value={text("companyName")} onChange={(event) => onPatch({ companyName: event.target.value, showUnsubscribe: true })} placeholder="Company" style={fieldStyle(color, tokens.fonts.body, tokens.type.small.size)} />
        <input value={text("physicalAddress")} onChange={(event) => onPatch({ physicalAddress: event.target.value, showUnsubscribe: true })} placeholder="Physical address" style={fieldStyle(tokens.colors.muted, tokens.fonts.body, tokens.type.small.size)} />
        <p style={fieldStyle(tokens.colors.link, tokens.fonts.ui, tokens.type.small.size)}>Unsubscribe</p>
      </div>
    );
  }
  return null;
}

function ColumnFields({
  heading,
  body,
  tokens,
  color,
  onHeading,
  onBody,
}: {
  heading: string;
  body: string;
  tokens: EmailDesignTokens;
  color: string;
  onHeading: (value: string) => void;
  onBody: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <input value={heading} onChange={(event) => onHeading(event.target.value)} placeholder="Heading" style={displayStyle(color, tokens.fonts.heading, tokens.type.heading)} />
      <textarea value={body} onChange={(event) => onBody(event.target.value)} placeholder="Body" rows={4} style={fieldStyle(color, tokens.fonts.body, tokens.type.body.size)} />
    </div>
  );
}
