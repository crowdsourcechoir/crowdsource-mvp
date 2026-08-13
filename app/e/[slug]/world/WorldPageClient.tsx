"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import EventNotFound from "../EventNotFound";
import WorldJourney from "@/components/song-garden-v2/WorldJourney";
import WorldLoadingShell from "@/components/song-garden-v2/WorldLoadingShell";

export default function WorldPageClient() {
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

  if (!loaded) return <WorldLoadingShell slug={slug} />;
  if (!event) return <EventNotFound />;
  return <WorldJourney event={event} />;
}
