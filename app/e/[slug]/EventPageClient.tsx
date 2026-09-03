"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import type { EventPageTheme } from "@/lib/event-page-theme";
import EventNotFound from "./EventNotFound";
import WorldLoadingShell from "@/components/song-garden-v2/WorldLoadingShell";

const WorldJourney = dynamic(() => import("@/components/song-garden-v2/WorldJourney"), {
  ssr: false,
});

type EventPageClientProps = {
  slug?: string;
  initialEvent?: Event;
  initialTheme?: EventPageTheme;
};

function EventPageInner({
  slug: slugProp,
  initialEvent,
  initialTheme,
}: EventPageClientProps) {
  const params = useParams();
  const slug =
    slugProp?.trim() || (typeof params?.slug === "string" ? params.slug.trim() : "");
  const [event, setEvent] = useState<Event | null>(initialEvent ?? null);
  const [loaded, setLoaded] = useState(Boolean(initialEvent));

  useEffect(() => {
    if (initialEvent) return;
    getEventBySlug(slug)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoaded(true));
  }, [slug, initialEvent]);

  const shellProps = initialTheme
    ? {
        primaryColor: initialTheme.primaryColor,
        accentColor: initialTheme.accentColor,
        firstSceneUrl: initialTheme.firstSceneUrl,
        slug,
      }
    : { slug };

  if (!loaded) return <WorldLoadingShell {...shellProps} />;
  if (!event) return <EventNotFound />;
  return <WorldJourney event={event} />;
}

/** Public event page — Song Garden World is the participant experience. */
export default function EventPageClient(props: EventPageClientProps) {
  const shell = props.initialTheme ? (
    <WorldLoadingShell
      primaryColor={props.initialTheme.primaryColor}
      accentColor={props.initialTheme.accentColor}
      firstSceneUrl={props.initialTheme.firstSceneUrl}
      slug={props.slug}
    />
  ) : (
    <WorldLoadingShell slug={props.slug} />
  );

  return (
    <Suspense fallback={shell}>
      <EventPageInner {...props} />
    </Suspense>
  );
}
