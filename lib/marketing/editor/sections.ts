import type { EmailSection, ImageRef, SectionType } from "../document/types";
import { parseEmailDocument } from "../document/schema";
import type { EmailDocument } from "../document/types";

export const SECTION_LABELS: { type: SectionType; label: string }[] = [
  { type: "hero", label: "Hero" },
  { type: "full_bleed_image", label: "Image" },
  { type: "editorial_text", label: "Text" },
  { type: "large_statement", label: "Statement" },
  { type: "image_story", label: "Story" },
  { type: "two_column", label: "Columns" },
  { type: "pull_quote", label: "Quote" },
  { type: "event", label: "Event" },
  { type: "song_garden_invitation", label: "Song Garden" },
  { type: "artist_feature", label: "Artist" },
  { type: "cta", label: "CTA" },
  { type: "gallery", label: "Gallery" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "footer", label: "Footer" },
];

export function sectionLabel(type: string): string {
  return SECTION_LABELS.find((item) => item.type === type)?.label ?? type;
}

function id(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function base(type: SectionType, props: Record<string, unknown>): EmailSection {
  return {
    id: id(),
    type,
    spacing: "medium",
    background: "canvas",
    align: "left",
    hideOnMobile: false,
    props,
  };
}

const emptyImage = (): ImageRef | null => null;

export function newSection(type: SectionType): EmailSection {
  switch (type) {
    case "hero":
      return base(type, { eyebrow: "", title: "Crowdsource Choir", subtitle: "", image: emptyImage(), ctaLabel: "", ctaHref: "" });
    case "full_bleed_image":
      return base(type, { image: emptyImage(), href: null });
    case "editorial_text":
      return base(type, {
        heading: "",
        text: "",
        body: { type: "doc", content: [{ type: "paragraph" }] },
      });
    case "large_statement":
      return base(type, { eyebrow: "", text: "A line worth singing." });
    case "image_story":
      return base(type, { image: emptyImage(), imagePosition: "left", heading: "", text: "", ctaLabel: "", ctaHref: "" });
    case "two_column":
      return base(type, { leftHeading: "", leftText: "", rightHeading: "", rightText: "" });
    case "pull_quote":
      return base(type, { quote: "", attribution: "" });
    case "event":
      return base(type, { eventId: null, title: "", description: "", venue: "", date: "", href: "", ctaLabel: "Open event", image: emptyImage() });
    case "song_garden_invitation":
      return base(type, { heading: "Song Garden", text: "", image: emptyImage(), ctaLabel: "Open the garden", ctaHref: "https://app.crowdsourcechoir.com" });
    case "artist_feature":
      return base(type, { name: "", role: "", bio: "", href: "", image: emptyImage() });
    case "cta":
      return base(type, { label: "Learn more", href: "https://app.crowdsourcechoir.com", style: "solid" });
    case "gallery":
      return base(type, { images: [] });
    case "divider":
      return base(type, {});
    case "spacer":
      return base(type, {});
    case "footer":
      return base(type, { companyName: "Crowdsource Choir", physicalAddress: "", showUnsubscribe: true });
    default:
      return base("divider", {});
  }
}

export function duplicateSection(section: EmailSection): EmailSection {
  return { ...section, id: id(), props: { ...section.props } };
}

/** Copy a template document onto a campaign without keeping a live pointer. */
export function documentFromTemplate(template: EmailDocument, designSystemId: string, internalTitle: string): EmailDocument {
  return parseEmailDocument({
    ...template,
    designSystemId,
    meta: { internalTitle },
    sections: template.sections.map((section) => ({ ...section, id: id() })),
  });
}
