"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import { publicEventPath } from "@/lib/event-slug-aliases";
import SonggardenCanvas from "@/components/songgarden/SonggardenCanvas";

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function SonggardenAdminPage() {
  const params = useParams();
  const router = useRouter();
  const param =
    typeof params?.eventId === "string"
      ? params.eventId
      : typeof params?.slug === "string"
        ? params.slug
        : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        let next: Event | null = null;
        if (looksLikeUuid(param)) {
          next = await getEventById(param);
          if (next?.slug && next.slug !== param) {
            router.replace(`/admin/songgarden/${encodeURIComponent(next.slug)}`);
            return;
          }
        } else {
          next = await getEventBySlug(param);
          if (!next && param) {
            next = await getEventById(param);
          }
        }
        if (!cancelled) setEvent(next);
      } catch {
        if (!cancelled) setEvent(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [param, router]);

  if (!loaded) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!event) {
    return (
      <div>
        <p className="text-gray-400">Song Garden not found.</p>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          Open a bloom&apos;s Song Garden from the bloom page, or use Master Composer for the full library.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/composer" className="font-medium text-[#CFFF81] hover:underline">
            ← Composer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/composer" className="text-gray-400 hover:text-white">
          ← Composer
        </Link>
        <span className="text-gray-600">·</span>
        <span className="text-gray-300">{event.title}</span>
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
      <SonggardenCanvas
        eventId={event.id}
        eventTitle={event.title}
        eventSlug={event.slug}
      />
    </div>
  );
}
