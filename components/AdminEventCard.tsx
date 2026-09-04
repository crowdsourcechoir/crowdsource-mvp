"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { canonicalEventSlug, publicEventUrl } from "@/lib/event-slug-aliases";
import { formatDateLong, formatTime } from "@/lib/formatDate";
import { googleMapsSearchUrl } from "./AddressMap";
import EventHeroThumb from "./EventHeroThumb";
import QRCodeDisplay from "./QRCodeDisplay";
import AdminClickableRow, { ADMIN_ROW_ACTION } from "./AdminClickableRow";

type AdminEventCardProps = {
  event: Event;
  baseUrl?: string;
  badgeLabel?: string;
};

export default function AdminEventCard({ event, baseUrl = "http://localhost:3000", badgeLabel }: AdminEventCardProps) {
  const [showQr, setShowQr] = useState(false);
  const manageHref = `/admin/events/${event.id}`;

  const eventUrl = useMemo(() => {
    return publicEventUrl(baseUrl, event.slug);
  }, [baseUrl, event.slug]);
  const publicSlug = canonicalEventSlug(event.slug);

  const timeFormatted = formatTime(event.time);
  const dateFormatted = formatDateLong(event.date);

  return (
    <AdminClickableRow href={manageHref} ariaLabel={`Manage ${event.title}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
            <EventHeroThumb src={event.heroImage} title={event.title} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold text-white sm:truncate">{event.title}</h3>
            <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-gray-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span>
                {dateFormatted} · {timeFormatted}
              </span>
              <span className="inline-flex items-center gap-1">
                📍
                <a
                  href={googleMapsSearchUrl(event.venue, event.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ADMIN_ROW_ACTION} hover:text-gray-200 hover:underline`}
                >
                  {event.venue}
                </a>
              </span>
              {badgeLabel && (
                <span className="mt-1 w-fit rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-gray-300 sm:mt-0">
                  {badgeLabel}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={`${ADMIN_ROW_ACTION} flex flex-wrap items-center gap-2 sm:shrink-0`}>
          <Link
            href={manageHref}
            className="rounded-lg bg-[#CFFF81] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#bdf25e]"
          >
            Manage
          </Link>
          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
            title={eventUrl}
          >
            Public Link
          </a>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
          >
            {showQr ? "Hide QR" : "QR"}
          </button>
        </div>
      </div>
      {showQr && (
        <div className={`${ADMIN_ROW_ACTION} mt-3 sm:ml-20`}>
          <QRCodeDisplay
            key={eventUrl}
            url={eventUrl}
            size={96}
            className="rounded border border-white/15"
            downloadFilename={`${publicSlug}-qr.png`}
          />
        </div>
      )}
    </AdminClickableRow>
  );
}
