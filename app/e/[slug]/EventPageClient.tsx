"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import PublicEventContent from "./PublicEventContent";
import EventNotFound from "./EventNotFound";
import EventPageLoadingShell from "@/components/EventPageLoadingShell";

function EventPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const panelParam = searchParams.get("panel");
  const initialPanel = panelParam === "songgarden" ? "songgarden" : "landing";
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
  return <PublicEventContent event={event} initialPanel={initialPanel} />;
}

export default function EventPageClient() {
  return (
    <Suspense fallback={<EventPageLoadingShell />}>
      <EventPageInner />
    </Suspense>
  );
}
