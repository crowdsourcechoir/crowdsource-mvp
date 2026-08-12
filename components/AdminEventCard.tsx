"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { canonicalEventSlug, publicEventUrl } from "@/lib/event-slug-aliases";
import { formatDateLong, formatTime } from "@/lib/formatDate";
import { googleMapsSearchUrl } from "./AddressMap";
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
    <article className="overflow-hidden rounded-2xl border border-gray-700/60 bg-[#111216]">
      <div className="flex gap-4 border-b border-gray-700/60 p-4 sm:p-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-700/60 bg-[#1a1c22] sm:h-28 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.heroImage} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl font-semibold text-white">{event.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span>{dateFormatted} · {timeFormatted}</span>
            <span className="inline-flex items-center gap-1 text-gray-400">
              <span aria-hidden>📍</span>
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
              <span className="rounded-full border border-gray-600/80 bg-[#1b1f28] px-3 py-1 text-xs font-semibold text-gray-200">
                {badgeLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/events/${event.id}`}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-blue-600 px-5 py-2 text-base font-semibold text-white hover:bg-blue-700"
          >
            Manage Event
          </Link>
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-gray-700 bg-[#171a21] px-4 py-2 text-base font-medium text-gray-200 hover:bg-[#1d2230]"
            title={eventUrl}
          >
            View Public Link
          </a>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-gray-700 bg-[#171a21] px-4 py-2 text-base font-medium text-gray-200 hover:bg-[#1d2230]"
          >
            {showQr ? "Hide QR" : "Show QR"}
          </button>
        </div>
        {showQr && (
          <div className="mt-4">
            <QRCodeDisplay
              key={eventUrl}
              url={eventUrl}
              size={112}
              className="rounded border border-gray-600"
              downloadFilename={`${publicSlug}-qr.png`}
            />
          </div>
        )}
      </div>
    </article>
  );
}

