"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Bloom list row — same height/spacing as Composer; faint border; click opens Manage. */
export default function AdminEventCard({ event, baseUrl = "http://localhost:3000", badgeLabel }: AdminEventCardProps) {
  const router = useRouter();
  const [showQr, setShowQr] = useState(false);

  const eventUrl = useMemo(() => {
    return publicEventUrl(baseUrl, event.slug);
  }, [baseUrl, event.slug]);
  const publicSlug = canonicalEventSlug(event.slug);
  const manageHref = `/admin/events/${event.id}`;

  const timeFormatted = formatTime(event.time);
  const dateFormatted = formatDateLong(event.date);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => router.push(manageHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(manageHref);
        }
      }}
      className="cursor-pointer rounded-xl border border-white/10 bg-transparent px-4 py-4 transition-colors hover:border-[#CFFF81]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{event.title}</h3>
          <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-gray-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <span>
              {dateFormatted} · {timeFormatted}
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              📍
              <a
                href={googleMapsSearchUrl(event.venue, event.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-gray-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {event.venue}
              </a>
            </span>
            {badgeLabel ? (
              <span className="w-fit rounded-full border border-white/15 bg-transparent px-2 py-0.5 text-xs text-gray-400">
                {badgeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2 sm:shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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
            className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[#CFFF81] hover:text-white"
            title={eventUrl}
          >
            Public Link
          </a>
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[#CFFF81] hover:text-white"
          >
            {showQr ? "Hide QR" : "QR"}
          </button>
        </div>
      </div>
      {showQr ? (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <QRCodeDisplay
            key={eventUrl}
            url={eventUrl}
            size={96}
            className="rounded border border-white/15"
            downloadFilename={`${publicSlug}-qr.png`}
          />
        </div>
      ) : null}
    </article>
  );
}
