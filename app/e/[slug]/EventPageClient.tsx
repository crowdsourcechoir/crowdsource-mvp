"use client";

import { useParams } from "next/navigation";
import { getEventBySlug } from "@/data/eventsClient";
import PublicEventContent from "./PublicEventContent";
import EventNotFound from "./EventNotFound";

export default function EventPageClient() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const event = getEventBySlug(slug);

  if (!event) return <EventNotFound />;
  return <PublicEventContent event={event} />;
}
