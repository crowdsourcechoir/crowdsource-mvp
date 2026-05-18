"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import PublicEventContent from "./PublicEventContent";
import SongGardenPublicContent from "./SongGardenPublicContent";
import EventNotFound from "./EventNotFound";
import EventPageLoadingShell from "@/components/EventPageLoadingShell";
import { songGardenConfigFromBrief } from "@/data/songGarden";

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

  if (!loaded) return <EventPageLoadingShell />;
  if (!event) return <EventNotFound />;
  if (songGardenConfigFromBrief(event.agentBrief)) return <SongGardenPublicContent event={event} />;
  return <PublicEventContent event={event} />;
}
