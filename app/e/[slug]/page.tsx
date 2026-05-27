import type { Metadata } from "next";
import { buildEventMetadata } from "@/lib/event-open-graph";
import { getEventBySlugServer } from "@/lib/events-server";
import EventPageClient from "./EventPageClient";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const event = await getEventBySlugServer(params.slug);
  if (!event) {
    return { title: "Event not found · Crowdsource Choir" };
  }
  return buildEventMetadata(event, params.slug);
}

export default function PublicEventPage() {
  return <EventPageClient />;
}
