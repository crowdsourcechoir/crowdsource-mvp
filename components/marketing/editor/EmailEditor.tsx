"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { FieldLabel, TextField } from "@/components/settings/ui";
import { insertBlock, moveBlock } from "@/lib/marketing/editor/block-order";
import { duplicateSection, newSection, sectionLabel, SECTION_LABELS } from "@/lib/marketing/editor/sections";
import type { EmailSection, SectionType } from "@/lib/marketing/document/types";
import type { EmailDesignTokens } from "@/lib/marketing/render/tokens";
import InlineTextEditor from "@/components/marketing/editor/InlineTextEditor";
import Inspector from "@/components/marketing/editor/Inspector";
import { editorPreviewHtml } from "@/components/marketing/editor/preview-bridge";

type EventOption = { id: string; title: string; slug: string; date: string; venue: string };
type DragPayload = { kind: "new"; type: SectionType } | { kind: "move"; id: string };
type LayoutBox = { id: string; top: number; height: number };

function isBox(value: unknown): value is LayoutBox {
  if (!value || typeof value !== "object") return false;
  const box = value as LayoutBox;
  return typeof box.id === "string" && Number.isFinite(box.top) && Number.isFinite(box.height) && box.height >= 0 && box.height < 20000;
}

function dropIndexForY(y: number, boxes: { top: number; height: number }[]): number {
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (!box) continue;
    if (y < box.top + box.height / 2) return index;
  }
  return boxes.length;
}

export default function EmailEditor({
  sections,
  tokens,
  events,
  busy,
  previewHtml,
  mobile,
  onChange,
}: {
  sections: EmailSection[];
  tokens: EmailDesignTokens;
  events: EventOption[];
  busy: boolean;
  previewHtml: string;
  mobile: boolean;
  onChange: (sections: EmailSection[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null);
  const [dragging, setDragging] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [boxes, setBoxes] = useState<LayoutBox[]>([]);
  const [frameHeight, setFrameHeight] = useState(720);
  const dragPayload = useRef<DragPayload | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const dragActive = useRef(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const selected = sections.find((section) => section.id === selectedId) ?? null;
  const footerCount = sections.filter((section) => section.type === "footer").length;
  const width = mobile ? 375 : tokens.emailWidth;
  const placed = sections.flatMap((section) => {
    const box = boxes.find((item) => item.id === section.id);
    return box ? [{ ...box, type: section.type }] : [];
  });

  useEffect(() => {
    setBoxes([]);
  }, [previewHtml]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; height?: number; boxes?: unknown };
      if (!data || data.source !== "csc-email-preview" || data.type !== "layout") return;
      if (typeof data.height === "number" && data.height > 0) setFrameHeight(Math.min(data.height, 20000));
      if (Array.isArray(data.boxes)) setBoxes(data.boxes.filter(isBox));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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

  function indexFromEvent(event: DragEvent<HTMLElement>): number {
    const frame = frameRef.current;
    if (!frame || placed.length === 0) return sections.length;
    const y = event.clientY - frame.getBoundingClientRect().top;
    return dropIndexForY(y, placed);
  }

  const barTop =
    dropIndex == null
      ? null
      : placed.length === 0
        ? 24
        : dropIndex <= 0
          ? Math.max(0, (placed[0]?.top ?? 0) - 2)
          : dropIndex >= placed.length
            ? (placed[placed.length - 1]?.top ?? 0) + (placed[placed.length - 1]?.height ?? 0) - 2
            : (placed[dropIndex]?.top ?? 0) - 2;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,640px)_300px]">
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
          ref={frameRef}
          data-email-preview
          className="relative mx-auto overflow-hidden rounded-xl border border-[var(--csc-row-divider)] bg-black"
          style={{ width, height: previewHtml ? frameHeight : 420 }}
          onDragOver={(event) => {
            event.preventDefault();
            markDrop(indexFromEvent(event));
          }}
          onDrop={(event) => {
            event.preventDefault();
            dropAt(indexFromEvent(event));
          }}
        >
          {previewHtml ? (
            <iframe
              ref={iframeRef}
              title="Email"
              srcDoc={editorPreviewHtml(previewHtml)}
              sandbox="allow-scripts"
              className="pointer-events-none block h-full w-full border-0 bg-black"
            />
          ) : (
            <p className="px-6 pt-16 text-center text-sm text-gray-400">The email appears here.</p>
          )}
          <div className="absolute inset-0">
            {placed.map((box) => {
              const active = selectedId === box.id;
              return (
                <div
                  key={box.id}
                  data-section-id={box.id}
                  className={`group absolute inset-x-0 ${active ? "shadow-[inset_0_0_0_1px_var(--csc-accent)]" : "hover:shadow-[inset_0_0_0_1px_var(--csc-accent)]"}`}
                  style={{ top: box.top, height: box.height }}
                  onClick={() => setSelectedId(box.id)}
                >
                  <button
                    type="button"
                    draggable={!busy}
                    title="Drag to move"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(box.id);
                    }}
                    onDragStart={(event) => beginDrag(event, { kind: "move", id: box.id })}
                    onDragEnd={endDrag}
                    className={`absolute left-2 top-2 cursor-grab rounded-full border border-[var(--csc-accent)] bg-black/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)] active:cursor-grabbing ${
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {sectionLabel(box.type)}
                  </button>
                </div>
              );
            })}
            {dragging && barTop != null ? (
              <div className="pointer-events-none absolute inset-x-3 h-0.5 rounded-full bg-[var(--csc-accent)]" style={{ top: barTop }} />
            ) : null}
            {sections.length === 0 ? (
              <p className="pointer-events-none pt-16 text-center text-xs uppercase tracking-[0.14em] text-gray-400">Drop a section here</p>
            ) : null}
          </div>
        </div>
        {placed.length === 0 && sections.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                draggable={!busy}
                data-section-id={section.id}
                onClick={() => setSelectedId(section.id)}
                onDragStart={(event) => beginDrag(event, { kind: "move", id: section.id })}
                onDragEnd={endDrag}
                onDragOver={(event) => {
                  event.preventDefault();
                  markDrop(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dropAt(index);
                }}
                className={`cursor-grab rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  selectedId === section.id
                    ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                    : "border-white/20 text-gray-300"
                }`}
              >
                {sectionLabel(section.type)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <aside className="rounded-xl border border-[var(--csc-row-divider)] p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
        <p className="csc-eyebrow">{selected ? sectionLabel(selected.type) : "Section"}</p>
        <div className="mt-4 space-y-4">
          {selected ? <ContentFields section={selected} tokens={tokens} onPatch={(props) => patch(selected, props)} /> : null}
          <Inspector
            section={selected}
            events={events}
            onlyFooter={footerCount <= 1}
            onChange={update}
            onDuplicate={() => {
              if (!selected) return;
              const copy = duplicateSection(selected);
              const index = sections.findIndex((section) => section.id === selected.id);
              onChange(insertBlock(sections, copy, index + 1));
              setSelectedId(copy.id);
            }}
            onRemove={() => {
              if (!selected) return;
              const index = sections.findIndex((section) => section.id === selected.id);
              const next = sections.filter((section) => section.id !== selected.id);
              onChange(next);
              setSelectedId(next[Math.max(0, index - 1)]?.id ?? null);
            }}
          />
        </div>
      </aside>
    </div>
  );
}

function Area({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none"
    />
  );
}

function ContentFields({
  section,
  tokens,
  onPatch,
}: {
  section: EmailSection;
  tokens: EmailDesignTokens;
  onPatch: (props: Record<string, unknown>) => void;
}) {
  const text = (key: string) => (typeof section.props[key] === "string" ? String(section.props[key]) : "");

  if (section.type === "hero") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Eyebrow</FieldLabel>
          <TextField value={text("eyebrow")} onChange={(value) => onPatch({ eyebrow: value })} placeholder="Eyebrow" />
        </div>
        <div>
          <FieldLabel>Title</FieldLabel>
          <TextField value={text("title")} onChange={(value) => onPatch({ title: value })} placeholder="Title" />
        </div>
        <div>
          <FieldLabel>Subtitle</FieldLabel>
          <Area value={text("subtitle")} onChange={(value) => onPatch({ subtitle: value })} placeholder="Subtitle" rows={2} />
        </div>
        <div>
          <FieldLabel>Button label</FieldLabel>
          <TextField value={text("ctaLabel")} onChange={(value) => onPatch({ ctaLabel: value })} placeholder="Button label" />
        </div>
        <div>
          <FieldLabel>Button link</FieldLabel>
          <TextField value={text("ctaHref")} onChange={(value) => onPatch({ ctaHref: value })} placeholder="https://" />
        </div>
      </div>
    );
  }
  if (section.type === "editorial_text") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Heading</FieldLabel>
          <TextField value={text("heading")} onChange={(value) => onPatch({ heading: value })} placeholder="Heading" />
        </div>
        <div>
          <FieldLabel>Body</FieldLabel>
          <InlineTextEditor
            key={section.id}
            value={section.props.body}
            color={tokens.colors.ink}
            fontFamily={tokens.fonts.body}
            fontSize={tokens.type.body.size}
            onChange={(body) => onPatch({ body, text: "" })}
          />
        </div>
      </div>
    );
  }
  if (section.type === "large_statement") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Eyebrow</FieldLabel>
          <TextField value={text("eyebrow")} onChange={(value) => onPatch({ eyebrow: value })} placeholder="Eyebrow" />
        </div>
        <div>
          <FieldLabel>Statement</FieldLabel>
          <Area value={text("text")} onChange={(value) => onPatch({ text: value })} placeholder="Statement" />
        </div>
      </div>
    );
  }
  if (section.type === "pull_quote") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Quote</FieldLabel>
          <Area value={text("quote")} onChange={(value) => onPatch({ quote: value })} placeholder="Quote" />
        </div>
        <div>
          <FieldLabel>Attribution</FieldLabel>
          <TextField value={text("attribution")} onChange={(value) => onPatch({ attribution: value })} placeholder="Attribution" />
        </div>
      </div>
    );
  }
  if (section.type === "two_column") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Left heading</FieldLabel>
          <TextField value={text("leftHeading")} onChange={(value) => onPatch({ leftHeading: value })} />
        </div>
        <div>
          <FieldLabel>Left body</FieldLabel>
          <Area value={text("leftText")} onChange={(value) => onPatch({ leftText: value })} />
        </div>
        <div>
          <FieldLabel>Right heading</FieldLabel>
          <TextField value={text("rightHeading")} onChange={(value) => onPatch({ rightHeading: value })} />
        </div>
        <div>
          <FieldLabel>Right body</FieldLabel>
          <Area value={text("rightText")} onChange={(value) => onPatch({ rightText: value })} />
        </div>
      </div>
    );
  }
  if (section.type === "image_story" || section.type === "song_garden_invitation") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Heading</FieldLabel>
          <TextField value={text("heading")} onChange={(value) => onPatch({ heading: value })} placeholder="Heading" />
        </div>
        <div>
          <FieldLabel>Body</FieldLabel>
          <Area value={text("text")} onChange={(value) => onPatch({ text: value })} placeholder="Body" />
        </div>
        <div>
          <FieldLabel>Button label</FieldLabel>
          <TextField value={text("ctaLabel")} onChange={(value) => onPatch({ ctaLabel: value })} placeholder="Button label" />
        </div>
        <div>
          <FieldLabel>Button link</FieldLabel>
          <TextField value={text("ctaHref")} onChange={(value) => onPatch({ ctaHref: value })} placeholder="https://" />
        </div>
      </div>
    );
  }
  if (section.type === "artist_feature") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Name</FieldLabel>
          <TextField value={text("name")} onChange={(value) => onPatch({ name: value })} placeholder="Name" />
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <TextField value={text("role")} onChange={(value) => onPatch({ role: value })} placeholder="Role" />
        </div>
        <div>
          <FieldLabel>Bio</FieldLabel>
          <Area value={text("bio")} onChange={(value) => onPatch({ bio: value })} placeholder="Bio" />
        </div>
        <div>
          <FieldLabel>Name link</FieldLabel>
          <TextField value={text("href")} onChange={(value) => onPatch({ href: value })} placeholder="https://" />
        </div>
      </div>
    );
  }
  if (section.type === "cta") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Button label</FieldLabel>
          <TextField value={text("label")} onChange={(value) => onPatch({ label: value })} placeholder="Button label" />
        </div>
        <div>
          <FieldLabel>Button link</FieldLabel>
          <TextField value={text("href")} onChange={(value) => onPatch({ href: value })} placeholder="https://" />
        </div>
      </div>
    );
  }
  if (section.type === "event") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Title</FieldLabel>
          <TextField value={text("title")} onChange={(value) => onPatch({ title: value })} placeholder="Event title" />
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextField value={text("date")} onChange={(value) => onPatch({ date: value })} placeholder="Date" />
        </div>
        <div>
          <FieldLabel>Venue</FieldLabel>
          <TextField value={text("venue")} onChange={(value) => onPatch({ venue: value })} placeholder="Venue" />
        </div>
        <div>
          <FieldLabel>Description</FieldLabel>
          <Area value={text("description")} onChange={(value) => onPatch({ description: value })} placeholder="Description" rows={2} />
        </div>
        <div>
          <FieldLabel>Button label</FieldLabel>
          <TextField value={text("ctaLabel")} onChange={(value) => onPatch({ ctaLabel: value })} placeholder="Open event" />
        </div>
        <div>
          <FieldLabel>Button link</FieldLabel>
          <TextField value={text("href")} onChange={(value) => onPatch({ href: value })} placeholder="https://" />
        </div>
      </div>
    );
  }
  if (section.type === "footer") {
    return (
      <div className="space-y-3">
        <div>
          <FieldLabel>Company</FieldLabel>
          <TextField value={text("companyName")} onChange={(value) => onPatch({ companyName: value, showUnsubscribe: true })} placeholder="Company" />
        </div>
        <div>
          <FieldLabel>Physical address</FieldLabel>
          <TextField
            value={text("physicalAddress")}
            onChange={(value) => onPatch({ physicalAddress: value, showUnsubscribe: true })}
            placeholder="Physical address"
          />
        </div>
      </div>
    );
  }
  return null;
}
