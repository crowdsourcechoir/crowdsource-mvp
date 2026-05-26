"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildLocationQuery,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  isGoogleMapsEmbedConfigured,
} from "@/lib/google-maps";

export { googleMapsSearchUrl } from "@/lib/google-maps";

type AddressMapProps = {
  venue: string;
  address: string;
  className?: string;
};

const EMBED_DEBOUNCE_MS = 400;

export default function AddressMap({ venue, address, className = "" }: AddressMapProps) {
  const query = buildLocationQuery(venue, address);
  const [embedQuery, setEmbedQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query) {
      setEmbedQuery("");
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setEmbedQuery(query);
    }, EMBED_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!query) return null;

  const mapUrl = googleMapsSearchUrl(venue, address);
  const embedUrl = googleMapsEmbedUrl(embedQuery);
  const updating = query !== embedQuery;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-400 hover:text-gray-300 hover:underline"
        >
          Open in Google Maps
        </a>
        {!isGoogleMapsEmbedConfigured() && (
          <span className="text-xs text-gray-500">
            Add <code className="text-gray-400">NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY</code> for official embeds
          </span>
        )}
      </div>
      <div className="relative mt-2 flex h-52 w-full overflow-hidden rounded-xl border border-gray-700/60 bg-[#1f1f1f]">
        {embedUrl && (
          <iframe
            title="Google Map"
            src={embedUrl}
            className="h-full w-full flex-1 border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
        {updating && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#1f1f1f]/70 text-sm text-gray-400">
            Updating map…
          </div>
        )}
      </div>
    </div>
  );
}
