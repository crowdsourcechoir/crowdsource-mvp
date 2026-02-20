"use client";

import { useState, useEffect, useRef } from "react";

type AddressMapProps = {
  venue: string;
  address: string;
  className?: string;
};

const GEOCODE_DEBOUNCE_MS = 400;

export function googleMapsSearchUrl(venue: string, address: string): string {
  const query = [venue, address].filter(Boolean).join(", ");
  if (!query.trim()) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function AddressMap({ venue, address, className = "" }: AddressMapProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const query = [venue, address].filter(Boolean).join(", ").trim();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query) {
      setCoords(null);
      setLoading(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setLoading(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          headers: { Accept: "application/json", "User-Agent": "CrowdsourceChoirMVP/1.0" },
        }
      )
        .then((r) => r.json())
        .then((arr: { lat: string; lon: string }[]) => {
          if (arr?.[0]) setCoords({ lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) });
          else setCoords(null);
        })
        .catch(() => setCoords(null))
        .finally(() => setLoading(false));
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const mapUrl = googleMapsSearchUrl(venue, address);

  if (!query) return null;

  return (
    <div className={className}>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-gray-400 hover:text-gray-300 hover:underline"
      >
        View on map
      </a>
      <div className="mt-2 flex h-52 w-full overflow-hidden rounded-xl border border-gray-700/60 bg-[#1f1f1f]">
        {loading && (
          <div className="flex h-full w-full items-center justify-center text-gray-500">
            Locating…
          </div>
        )}
        {coords && !loading && (
          <iframe
            title="Map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.02},${coords.lat - 0.02},${coords.lon + 0.02},${coords.lat + 0.02}&layer=mapnik&marker=${coords.lat},${coords.lon}`}
            className="h-full w-full flex-1 border-0"
          />
        )}
      </div>
    </div>
  );
}
