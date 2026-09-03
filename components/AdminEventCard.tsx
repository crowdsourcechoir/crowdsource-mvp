"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { canonicalEventSlug, publicEventUrl } from "@/lib/event-slug-aliases";
import { formatDateLong, formatTime } from "@/lib/formatDate";
import { googleMapsSearchUrl } from "./AddressMap";
import EventHeroThumb from "./EventHeroThumb";
import QRCodeDisplay from "./QRCodeDisplay";

type AdminEventCardProps = {
  event: Event;
  baseUrl?: string;
  badgeLabel?: string;
};

export default function AdminEventCard({ event, baseUrl = "http://localhost:3000", badgeLabel }: AdminEventCardProps) {
  const [showQr, setShowQr] = useState(false);

  const eventUrl = useMemo(() => {
    return publicEventUrl(baseUrl, event.slug);
  }, [baseUrl, event.slug]);
  const publicSlug = canonicalEventSlug(event.slug);

  const timeFormatted = formatTime(event.time);
  const dateFormatted = formatDateLong(event.date);

  return (
    <article className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#121214] px-4 py-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-700/60 bg-[#1a1c22]">
        <EventHeroThumb src={event.heroImage} title={event.title} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-white">{event.title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>{dateFormatted} · {timeFormatted}</span>
          <span className="inline-flex items-center gap-1">
            📍
            <a
              href={googleMapsSearchUrl(event.venue, event.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-200 hover:underline"
            >
              {event.venue}
            </a>
          </span>
          {badgeLabel && (
            <span className="rounded-full border border-gray-600/80 bg-[#1b1f28] px-2 py-0.5 text-xs text-gray-300">
              {badgeLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/admin/events/${event.id}`}
          className="rounded-lg bg-[#CFFF81] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bdf25e]"
        >
          Manage
        </Link>
        <a
          href={eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
          title={eventUrl}
        >
          Public Link
        </a>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800"
        >
          {showQr ? "Hide QR" : "QR"}
        </button>
      </div>
      {showQr && (
        <div className="mt-3 ml-20">
          <QRCodeDisplay
            key={eventUrl}
            url={eventUrl}
            size={96}
            className="rounded border border-gray-600"
            downloadFilename={`${publicSlug}-qr.png`}
          />
        </div>
      )}
    </article>
  );
}

