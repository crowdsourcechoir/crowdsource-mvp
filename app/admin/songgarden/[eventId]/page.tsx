"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import { publicEventPath } from "@/lib/event-slug-aliases";
import SonggardenCanvas from "@/components/songgarden/SonggardenCanvas";

export default function SonggardenAdminPage() {
  const params = useParams();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getEventById(eventId)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoaded(true));
  }, [eventId]);

  if (!loaded) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!event) {
    return (
      <div>
        <p className="text-gray-400">Event not found.</p>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          This composition canvas needs a valid Bloom id. Pick a bloom from Composer or the Blooms list.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/composer" className="font-medium text-[#CFFF81] hover:underline">
            Open Composer
          </Link>
          <Link href="/admin/events" className="text-gray-400 hover:underline">
            Back to blooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/admin/events/${event.id}`} className="text-gray-400 hover:text-white">
          ← {event.title}
        </Link>
        <span className="text-gray-600">·</span>
        <Link
          href={publicEventPath(event.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#CFFF81] hover:underline"
        >
          Public drop link
        </Link>
      </div>
      <SonggardenCanvas eventId={event.id} eventTitle={event.title} />
    </div>
  );
}
