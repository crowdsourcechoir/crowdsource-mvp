import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { buildEventMetadata } from "@/lib/event-open-graph";
import { canonicalEventSlug, isAliasedEventSlug } from "@/lib/event-slug-aliases";
import { getEventBySlugServer } from "@/lib/events-server";
import EventPageClient from "./EventPageClient";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = canonicalEventSlug(params.slug);
  const event = await getEventBySlugServer(slug);
  if (!event) {
    return { title: "Event not found · Crowdsource Choir" };
  }
  return buildEventMetadata(event, slug);
}

export default function PublicEventPage({ params }: PageProps) {
  if (isAliasedEventSlug(params.slug)) {
    permanentRedirect(`/e/${canonicalEventSlug(params.slug)}`);
  }

  return <EventPageClient />;
}
