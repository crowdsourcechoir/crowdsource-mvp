import type { EmailBlock } from "../types";
import { parseEmailDocument } from "./schema";
import type { EmailDocument, EmailSection, ImageRef, SectionType } from "./types";

function sectionBase(id: string, type: SectionType, props: Record<string, unknown>): EmailSection {
  return {
    id,
    type,
    spacing: "medium",
    background: "canvas",
    align: "left",
    hideOnMobile: false,
    props,
  };
}

function imageRef(url: string, alt = "", assetId = ""): ImageRef | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const id = assetId.trim();
  return { assetId: id || null, url: trimmed, alt, ratio: "landscape" };
}

function textOf(props: Record<string, unknown>): string {
  return typeof props.text === "string" ? props.text : "";
}

function str(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === "string" ? value : "";
}

export function legacyBlocksToDocument(
  blocks: EmailBlock[],
  designSystemId: string,
  internalTitle: string
): EmailDocument {
  const sections = blocks.map((block) => {
    const props = block.props ?? {};
    switch (block.type) {
      case "hero":
        return sectionBase(block.id, "hero", {
          eyebrow: "",
          title: str(props, "title"),
          subtitle: str(props, "subtitle"),
          image: imageRef(str(props, "imageUrl"), str(props, "alt"), str(props, "assetId")),
          ctaLabel: "",
          ctaHref: "",
        });
      case "rich_text":
        return sectionBase(block.id, "editorial_text", {
          heading: null,
          text: textOf(props),
        });
      case "image":
        return sectionBase(block.id, "full_bleed_image", {
          image: imageRef(str(props, "imageUrl"), str(props, "alt"), str(props, "assetId")),
          href: str(props, "href") || null,
        });
      case "cta":
        return sectionBase(block.id, "cta", {
          label: str(props, "label") || "Learn more",
          href: str(props, "href"),
          style: "solid",
        });
      case "divider":
        return sectionBase(block.id, "divider", {});
      case "footer":
        return sectionBase(block.id, "footer", {
          companyName: str(props, "companyName"),
          physicalAddress: str(props, "physicalAddress"),
          showUnsubscribe: true,
        });
      case "event":
        return sectionBase(block.id, "event", {
          eventId: str(props, "eventId") || null,
          title: str(props, "title"),
          description: str(props, "description"),
          venue: str(props, "venue"),
          date: str(props, "date"),
          href: str(props, "url") || str(props, "href"),
          ctaLabel: str(props, "ctaText") || str(props, "ctaLabel") || "Open event",
          image: imageRef(str(props, "heroImage"), str(props, "alt"), str(props, "assetId")),
        });
      default:
        throw new Error(`Cannot store block type ${block.type}`);
    }
  });

  return parseEmailDocument({
    schemaVersion: 1,
    designSystemId,
    meta: { internalTitle },
    personalization: { missingTokenBehavior: "fallback", fallbacks: { first_name: "friend" } },
    sections,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function htmlFromText(text: string): string {
  if (!text) return "";
  return text
    .split(/\n\n+/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function imageUrl(props: Record<string, unknown>): string {
  const image = props.image;
  if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
    return (image as { url: string }).url;
  }
  return "";
}

function imageAlt(props: Record<string, unknown>): string {
  const image = props.image;
  if (image && typeof image === "object" && typeof (image as { alt?: unknown }).alt === "string") {
    return (image as { alt: string }).alt;
  }
  return "";
}

function imageAssetId(props: Record<string, unknown>): string {
  const image = props.image;
  if (image && typeof image === "object" && typeof (image as { assetId?: unknown }).assetId === "string") {
    return (image as { assetId: string }).assetId;
  }
  return "";
}

export function documentToLegacyBlocks(document: EmailDocument): EmailBlock[] {
  return document.sections.map((section) => {
    const props = section.props;
    switch (section.type) {
      case "hero":
        return {
          id: section.id,
          type: "hero",
          props: {
            title: str(props, "title"),
            subtitle: str(props, "subtitle"),
            imageUrl: imageUrl(props),
            assetId: imageAssetId(props),
          },
        };
      case "editorial_text":
        const text = str(props, "text");
        return { id: section.id, type: "rich_text", props: { text, html: htmlFromText(text) } };
      case "full_bleed_image":
        return {
          id: section.id,
          type: "image",
          props: { imageUrl: imageUrl(props), alt: imageAlt(props), href: str(props, "href"), assetId: imageAssetId(props) },
        };
      case "cta":
        return { id: section.id, type: "cta", props: { label: str(props, "label"), href: str(props, "href") } };
      case "divider":
        return { id: section.id, type: "divider", props: {} };
      case "footer":
        return {
          id: section.id,
          type: "footer",
          props: {
            companyName: str(props, "companyName"),
            physicalAddress: str(props, "physicalAddress"),
          },
        };
      case "event":
        return {
          id: section.id,
          type: "event",
          props: {
            eventId: str(props, "eventId"),
            title: str(props, "title"),
            description: str(props, "description"),
            venue: str(props, "venue"),
            date: str(props, "date"),
            url: str(props, "href"),
            ctaText: str(props, "ctaLabel"),
            heroImage: imageUrl(props),
            assetId: imageAssetId(props),
          },
        };
      default:
        throw new Error(`Unknown email document schemaVersion section ${section.type}`);
    }
  });
}

export function migrateEmailDocument(raw: unknown): EmailDocument {
  if (!raw || typeof raw !== "object") throw new Error("Email document is missing");
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (version !== 1) throw new Error(`Unknown email document schemaVersion: ${String(version)}`);
  return parseEmailDocument(raw);
}
