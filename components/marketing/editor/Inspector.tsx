"use client";

import { FieldLabel, SettingsButton, TextField } from "@/components/settings/ui";
import EmailImageField from "@/components/marketing/EmailImageField";
import type { EmailSection, ImageRef } from "@/lib/marketing/document/types";

type EventOption = { id: string; title: string; slug: string; date: string; venue: string };

const PHOTO_SECTIONS = new Set(["hero", "full_bleed_image", "image_story", "song_garden_invitation", "artist_feature", "event"]);

function imageOf(props: Record<string, unknown>): ImageRef | null {
  const image = props.image;
  if (!image || typeof image !== "object") return null;
  const record = image as ImageRef;
  return typeof record.url === "string" ? record : null;
}

function storedPhotoLink(section: EmailSection): string {
  const image = imageOf(section.props);
  if (typeof image?.href === "string" && image.href.trim()) return image.href;
  if (typeof section.props.photoHref === "string" && section.props.photoHref.trim()) return section.props.photoHref;
  if (section.type === "full_bleed_image" && typeof section.props.href === "string") return section.props.href;
  return "";
}

function withPhotoLink(section: EmailSection, href: string): EmailSection {
  const image = imageOf(section.props);
  const trimmed = href.trim();
  const props: Record<string, unknown> = {
    ...section.props,
    photoHref: trimmed,
    image: image ? { ...image, href: trimmed || null } : (section.props.image ?? null),
  };
  if (section.type === "full_bleed_image") props.href = trimmed || null;
  return { ...section, props };
}

function nextImage(
  section: EmailSection,
  image: ImageRef | null,
  next: { imageUrl: string; assetId: string | null; alt?: string }
): ImageRef | null {
  if (!next.imageUrl) return null;
  const stored =
    (typeof image?.href === "string" && image.href) ||
    (typeof section.props.photoHref === "string" && section.props.photoHref) ||
    (section.type === "full_bleed_image" && typeof section.props.href === "string" && section.props.href) ||
    null;
  return {
    assetId: next.assetId,
    url: next.imageUrl,
    alt: next.alt || image?.alt || "",
    ratio: image?.ratio ?? "landscape",
    href: stored,
  };
}

function setString(section: EmailSection, key: string, value: string): EmailSection {
  return { ...section, props: { ...section.props, [key]: value } };
}

export default function Inspector({
  section,
  events,
  onlyFooter,
  onChange,
  onDuplicate,
  onRemove,
}: {
  section: EmailSection | null;
  events: EventOption[];
  onlyFooter: boolean;
  onChange: (section: EmailSection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  if (!section) {
    return <p className="text-sm text-gray-400">Click a section in the email to edit it.</p>;
  }

  const image = imageOf(section.props);

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Spacing</FieldLabel>
        <select
          value={section.spacing}
          onChange={(event) => onChange({ ...section, spacing: event.target.value as EmailSection["spacing"] })}
          className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="xl">XL</option>
        </select>
      </div>
      <div>
        <FieldLabel>Background</FieldLabel>
        <select
          value={section.background}
          onChange={(event) => onChange({ ...section, background: event.target.value as EmailSection["background"] })}
          className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
        >
          <option value="canvas">Canvas</option>
          <option value="surface">Surface</option>
          <option value="brand">Brand</option>
          <option value="ink">Ink</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      {section.background === "custom" ? (
        <div>
          <FieldLabel>Custom color</FieldLabel>
          <TextField value={section.customBackground ?? ""} onChange={(value) => onChange({ ...section, customBackground: value })} placeholder="#111111" />
        </div>
      ) : null}
      <div>
        <FieldLabel>Align</FieldLabel>
        <select
          value={section.align}
          onChange={(event) => onChange({ ...section, align: event.target.value as EmailSection["align"] })}
          className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={section.hideOnMobile}
          onChange={(event) => onChange({ ...section, hideOnMobile: event.target.checked })}
        />
        Hide on mobile
      </label>

      {section.type === "image_story" ? (
        <div>
          <FieldLabel>Image side</FieldLabel>
          <select
            value={String(section.props.imagePosition ?? "left")}
            onChange={(event) => onChange(setString(section, "imagePosition", event.target.value))}
            className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>
      ) : null}

      {section.type === "cta" ? (
        <div>
          <FieldLabel>Button style</FieldLabel>
          <select
            value={String(section.props.style ?? "solid")}
            onChange={(event) => onChange(setString(section, "style", event.target.value))}
            className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="solid">Solid</option>
            <option value="outline">Outline</option>
          </select>
        </div>
      ) : null}

      {image || section.type === "hero" || section.type === "full_bleed_image" || section.type === "image_story" || section.type === "song_garden_invitation" || section.type === "artist_feature" || section.type === "event" ? (
        <div>
          <EmailImageField
            key={section.id}
            sizeNote={section.type === "hero" || section.type === "full_bleed_image" ? "1120 × 400" : undefined}
            imageUrl={image?.url ?? ""}
            onChange={(next) =>
              onChange({
                ...section,
                props: { ...section.props, image: nextImage(section, image, next) },
              })
            }
          />
          {PHOTO_SECTIONS.has(section.type) ? <PhotoLinkField section={section} onChange={onChange} /> : null}
          {image ? (
            <div className="mt-3">
              <FieldLabel>Image shape</FieldLabel>
              <select
                value={image.ratio}
                onChange={(event) =>
                  onChange({
                    ...section,
                    props: { ...section.props, image: { ...image, ratio: event.target.value } },
                  })
                }
                className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
              >
                <option value="landscape">Landscape</option>
                <option value="square">Square</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {section.type === "gallery" ? <GalleryFields section={section} onChange={onChange} /> : null}

      {section.type === "event" ? (
        <div>
          <FieldLabel hint="Read-only Bloom picker">Event</FieldLabel>
          <select
            value={String(section.props.eventId ?? "")}
            onChange={(event) => {
              const eventId = event.target.value;
              const match = events.find((item) => item.id === eventId);
              onChange({
                ...section,
                props: {
                  ...section.props,
                  eventId: eventId || null,
                  title: match?.title ?? "",
                  date: match?.date ?? "",
                  venue: match?.venue ?? "",
                  href: match ? `https://app.crowdsourcechoir.com/e/${match.slug}` : "",
                },
              });
            }}
            className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Select bloom/event…</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SettingsButton onClick={onDuplicate}>Duplicate</SettingsButton>
        <SettingsButton variant="danger" disabled={onlyFooter && section.type === "footer"} onClick={onRemove}>
          Remove
        </SettingsButton>
      </div>
    </div>
  );
}

function PhotoLinkField({ section, onChange }: { section: EmailSection; onChange: (section: EmailSection) => void }) {
  const value = storedPhotoLink(section);
  const invalid = value.trim() !== "" && !/^(https?:\/\/|mailto:)/i.test(value.trim());
  return (
    <div className="mt-3">
      <FieldLabel hint="The photo opens this when someone clicks it.">Photo link</FieldLabel>
      <TextField value={value} onChange={(next) => onChange(withPhotoLink(section, next))} placeholder="https://" />
      {invalid ? <p className="mt-1 text-xs text-red-300">Use a full https:// or mailto: link.</p> : null}
    </div>
  );
}

function GalleryFields({ section, onChange }: { section: EmailSection; onChange: (section: EmailSection) => void }) {
  const images = Array.isArray(section.props.images) ? (section.props.images as ImageRef[]) : [];
  const slots = [0, 1, 2];
  return (
    <div className="space-y-4">
      {slots.map((index) => {
        const current = images[index];
        const link = typeof current?.href === "string" ? current.href : "";
        const invalid = link.trim() !== "" && !/^(https?:\/\/|mailto:)/i.test(link.trim());
        return (
          <div key={index}>
            <EmailImageField
              imageUrl={current?.url ?? ""}
              onChange={(next) => {
                const copy = [...images];
                if (!next.imageUrl) copy.splice(index, 1);
                else {
                  copy[index] = {
                    assetId: next.assetId,
                    url: next.imageUrl,
                    alt: next.alt || copy[index]?.alt || "",
                    ratio: copy[index]?.ratio ?? "square",
                    href: copy[index]?.href ?? null,
                  };
                }
                onChange({ ...section, props: { ...section.props, images: copy.filter((image) => image?.url) } });
              }}
            />
            {current?.url ? (
              <div className="mt-2">
                <FieldLabel hint="This photo opens this when someone clicks it.">Photo link</FieldLabel>
                <TextField
                  value={link}
                  onChange={(next) => {
                    const copy = images.map((image, imageIndex) =>
                      imageIndex === index ? { ...image, href: next.trim() || null } : image
                    );
                    onChange({ ...section, props: { ...section.props, images: copy } });
                  }}
                  placeholder="https://"
                />
                {invalid ? <p className="mt-1 text-xs text-red-300">Use a full https:// or mailto: link.</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
