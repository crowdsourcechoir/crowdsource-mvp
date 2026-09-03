import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { buildEventMetadata } from "@/lib/event-open-graph";
import { canonicalEventSlug, isAliasedEventSlug } from "@/lib/event-slug-aliases";
import { eventPageTheme } from "@/lib/event-page-theme";
import { getPublicEventBySlugServer } from "@/lib/events-server";
import EventNotFound from "./EventNotFound";
import EventPageClient from "./EventPageClient";

type PageProps = {
  params: { slug: string };
};

/** ISR — event config cached at the edge; refreshes within ~60s of admin edits. */
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = canonicalEventSlug(params.slug);
  const event = await getPublicEventBySlugServer(slug);
  if (!event) {
    return { title: "Event not found · Crowdsource Choir" };
  }
  return buildEventMetadata(event, slug);
}

export default async function PublicEventPage({ params }: PageProps) {
  if (isAliasedEventSlug(params.slug)) {
    permanentRedirect(`/e/${canonicalEventSlug(params.slug)}`);
  }

  const slug = canonicalEventSlug(params.slug);
  const event = await getPublicEventBySlugServer(slug);
  if (!event) {
    return <EventNotFound />;
  }

  const theme = eventPageTheme(event);

  return (
    <>
      {theme.firstSceneUrl ? (
        <link rel="preload" as="image" href={theme.firstSceneUrl} />
      ) : null}
      <EventPageClient slug={slug} initialEvent={event} initialTheme={theme} />
    </>
  );
}
