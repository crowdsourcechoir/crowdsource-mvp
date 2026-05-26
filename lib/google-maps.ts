const EMBED_API_KEY =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY ?? "" : "";

export function buildLocationQuery(venue: string, address: string): string {
  return [venue, address].filter(Boolean).join(", ").trim();
}

export function googleMapsSearchUrl(venue: string, address: string): string {
  const query = buildLocationQuery(venue, address);
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isGoogleMapsEmbedConfigured(): boolean {
  return EMBED_API_KEY.length > 0;
}

/** Google Maps embed iframe URL for a venue/address search. */
export function googleMapsEmbedUrl(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";

  const q = encodeURIComponent(trimmed);
  if (EMBED_API_KEY) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(EMBED_API_KEY)}&q=${q}`;
  }

  // Works without an API key for admin previews and public pages.
  return `https://maps.google.com/maps?q=${q}&hl=en&z=15&output=embed`;
}
