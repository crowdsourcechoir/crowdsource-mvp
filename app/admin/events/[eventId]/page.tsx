"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById } from "@/data/eventsClient";
import { googleMapsSearchUrl } from "@/components/AddressMap";
import type { Event } from "@/data/mockEvents";
import { publicEventPath } from "@/lib/event-slug-aliases";
import { confirmRareDelete } from "@/lib/confirm-rare-delete";

const btnPrimary =
  "rounded-md bg-[#CFFF81] px-2.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#b8f06a]";
const btnSecondary =
  "rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[#CFFF81] hover:text-white";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [deletingBloom, setDeletingBloom] = useState(false);

  useEffect(() => {
    getEventById(eventId)
      .then((e) => {
        setEvent(e);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [eventId]);

  async function handleDeleteBloom() {
    if (!event || deletingBloom) return;
    if (!confirmRareDelete("bloom", event.title)) return;
    setDeletingBloom(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Delete failed");
      }
      router.push("/admin/events");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete bloom.");
      setDeletingBloom(false);
    }
  }

  if (!loaded) {
    return (
      <div className="w-full px-4 py-12">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="w-full rounded-xl border border-gray-700 bg-transparent p-6">
        <p className="text-gray-400">Event not found.</p>
        <button
          type="button"
          onClick={() => router.push("/admin/events")}
          className="mt-4 text-sm font-medium text-white hover:underline"
        >
          Back to Blooms
        </button>
      </div>
    );
  }

  function displayPrompt(prompt: string): string {
    const colon = prompt.indexOf(":");
    if (colon >= 0) {
      const after = prompt.slice(colon + 1).trim();
      return after ? after.charAt(0).toUpperCase() + after.slice(1) : prompt;
    }
    return prompt;
  }

  const composerHref = `/admin/composer?bloom=${encodeURIComponent(event.slug || event.id)}`;

  return (
    <div className="w-full space-y-8 text-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/admin/events" className="csc-link text-sm font-medium">
            ← Blooms
          </Link>
          <p className="csc-eyebrow mt-4">Bloom</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{event.title}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {event.date} · {event.time}
            {" · "}
            <a
              href={googleMapsSearchUrl(event.venue, event.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="csc-link"
            >
              {event.venue}
            </a>
            {event.address ? (
              <>
                {" · "}
                <a
                  href={googleMapsSearchUrl(event.venue, event.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 hover:underline"
                >
                  {event.address}
                </a>
              </>
            ) : null}
          </p>
          {event.prompt ? (
            <p className="mt-3 text-sm text-gray-400">
              <span className="text-gray-500">Prompt:</span> {displayPrompt(event.prompt)}
            </p>
          ) : null}
          {event.description ? (
            <p className="mt-1 text-sm text-gray-400">
              <span className="text-gray-500">Description:</span> {event.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/admin/events/${event.id}/edit`} className={btnSecondary}>
              Edit bloom
            </Link>
            <Link
              href={publicEventPath(event.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondary}
            >
              Open public link
            </Link>
            <Link href={composerHref} className={btnPrimary}>
              Open Composer
            </Link>
          </div>
        </div>
        {event.heroImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={event.heroImage}
            alt=""
            className="h-28 w-44 shrink-0 rounded-lg border border-white/10 object-cover sm:h-32 sm:w-52"
          />
        ) : null}
      </div>

      <section className="border-y border-white/10 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Song Seed & submissions
        </h2>
        <p className="mt-1 max-w-xl text-xs text-gray-500">
          Song Seed, interviews, and sound packs live in Composer — use Open Composer above.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-gray-500">
          Delete this bloom (rare). Interviews, clips, and submissions are removed.
        </p>
        <button
          type="button"
          disabled={deletingBloom}
          onClick={() => void handleDeleteBloom()}
          className="text-xs font-medium text-red-300/90 underline hover:text-red-200 disabled:opacity-50"
        >
          {deletingBloom ? "Deleting…" : "Delete bloom"}
        </button>
      </div>
    </div>
  );
}
