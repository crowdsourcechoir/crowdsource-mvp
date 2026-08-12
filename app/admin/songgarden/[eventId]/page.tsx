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
        <Link href="/admin/events" className="mt-2 inline-block text-sm text-[#CFFF81] hover:underline">
          Back to events
        </Link>
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
