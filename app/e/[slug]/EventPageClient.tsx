"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import PublicEventContent from "./PublicEventContent";
import EventNotFound from "./EventNotFound";

export default function EventPageClient() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getEventBySlug(slug)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoaded(true));
  }, [slug]);

  if (!loaded) return <p className="min-h-screen bg-[#0c0c0e] p-8 text-center text-gray-400">Loading…</p>;
  if (!event) return <EventNotFound />;
  return <PublicEventContent event={event} />;
}
