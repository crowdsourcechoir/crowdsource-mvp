export const SECTION_TYPES = [
  "hero",
  "full_bleed_image",
  "editorial_text",
  "large_statement",
  "image_story",
  "two_column",
  "pull_quote",
  "event",
  "song_garden_invitation",
  "artist_feature",
  "cta",
  "gallery",
  "divider",
  "spacer",
  "footer",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export type ImageRatio = "portrait" | "square" | "landscape";

export type ImageRef = {
  assetId: string | null;
  url: string;
  alt: string;
  ratio: ImageRatio;
};

export type EmailSection = {
  id: string;
  type: SectionType;
  spacing: "small" | "medium" | "large" | "xl";
  background: "canvas" | "surface" | "brand" | "ink" | "custom";
  customBackground?: string;
  align: "left" | "center";
  hideOnMobile: boolean;
  props: Record<string, unknown>;
};

export type EmailDocument = {
  schemaVersion: 1;
  designSystemId: string;
  meta: { internalTitle: string };
  personalization: {
    missingTokenBehavior: "blank" | "fallback";
    fallbacks: { first_name?: string; display_name?: string };
  };
  sections: EmailSection[];
};
