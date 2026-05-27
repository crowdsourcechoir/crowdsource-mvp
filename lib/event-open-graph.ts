import type { Metadata } from "next";
import type { Event } from "@/data/mockEvents";
import { formatDateLong } from "@/lib/formatDate";
import { siteUrl } from "@/lib/site-url";

export function eventShareImageUrl(slug: string, heroImage: string | undefined): string {
  const base = siteUrl();
  if (heroImage?.startsWith("http://") || heroImage?.startsWith("https://")) {
    return heroImage;
  }
  if (heroImage?.startsWith("data:image/")) {
    return `${base}/e/${encodeURIComponent(slug)}/opengraph-image`;
  }
  return `${base}/logo.png`;
}

export function eventShareDescription(event: Event): string {
  const dateVenue = [formatDateLong(event.date), event.venue].filter(Boolean).join(" · ");
  if (dateVenue && event.description?.trim()) {
    return `${dateVenue} — ${event.description.trim()}`;
  }
  return dateVenue || event.description?.trim() || "Help crowdsource the song for this event.";
}

export function buildEventMetadata(event: Event, slug: string): Metadata {
  const base = siteUrl();
  const title = event.title;
  const description = eventShareDescription(event);
  const url = `${base}/e/${slug}`;
  const image = eventShareImageUrl(slug, event.heroImage);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Crowdsource Choir",
      type: "website",
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
