import Link from "next/link";
import type { Event } from "@/data/mockEvents";
import { googleMapsSearchUrl } from "./AddressMap";
import QRCodeDisplay from "./QRCodeDisplay";

type EventCardProps = {
  event: Event;
  baseUrl?: string;
};

export default function EventCard({ event, baseUrl = "http://localhost:3000" }: EventCardProps) {
  const eventUrl = `${baseUrl}/e/${event.slug}`;

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.heroImage}
          alt={event.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {event.date} · {event.time}
        </p>
        <a
          href={googleMapsSearchUrl(event.venue, event.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-sm text-gray-600 hover:text-gray-800 hover:underline"
        >
          {event.venue}
        </a>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href={`/e/${event.slug}`}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View
          </Link>
          <Link
            href={`/admin/conductor/${event.id}`}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Conductor
          </Link>
          <div className="ml-auto">
            <QRCodeDisplay url={eventUrl} size={64} />
          </div>
        </div>
      </div>
    </article>
  );
}
