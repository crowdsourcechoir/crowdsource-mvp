"use client";

import { useState } from "react";
import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { formatTimelineDate, formatTime } from "@/lib/formatDate";
import { googleMapsSearchUrl } from "./AddressMap";
import QRCodeDisplay from "./QRCodeDisplay";

type EventCardTimelineProps = {
  event: Event;
  baseUrl?: string;
};

export default function EventCardTimeline({ event, baseUrl = "http://localhost:3000" }: EventCardTimelineProps) {
  const { short: dateShort, dayOfWeek } = formatTimelineDate(event.date);
  const timeFormatted = formatTime(event.time);
  const base = (baseUrl ?? "").replace(/\/$/, "");
  const eventUrl = `${base || "http://localhost:3000"}/e/${event.slug}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-gray-700/60 bg-[#18181b] p-4 transition hover:border-gray-600 sm:flex-row sm:gap-6 sm:p-5">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-semibold text-gray-300">{timeFormatted}</p>
        <h3 className="mt-1 text-base font-bold text-white sm:text-lg">{event.title}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
          <span className="text-gray-600">📍</span>
          <a
            href={googleMapsSearchUrl(event.venue, event.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-300 hover:underline"
          >
            {event.venue}
          </a>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="truncate text-gray-500" title={eventUrl}>
            {eventUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={`/admin/events/${event.id}`}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 sm:min-h-0 sm:min-w-0 sm:justify-start"
          >
            Manage Event
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={`/e/${event.slug}`}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-gray-500 hover:text-gray-300 sm:min-h-0"
          >
            View public page
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-center justify-start gap-3 sm:ml-auto sm:gap-4">
        <QRCodeDisplay
          key={eventUrl}
          url={eventUrl}
          size={80}
          className="rounded border border-gray-600"
          downloadFilename={`${event.slug}-qr.png`}
        />
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-800 sm:h-28 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.heroImage}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </article>
  );
}

export { formatTimelineDate, formatTime } from "@/lib/formatDate";
export { formatDateLong } from "@/lib/formatDate";
