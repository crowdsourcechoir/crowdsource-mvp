"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, updateEvent } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { toDateInputValue, toTimeInputValue } from "@/lib/event-datetime-input";

type LoadStatus = "loading" | "ready" | "notFound";

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    setStatus("loading");
    setEvent(null);
    getEventById(eventId)
      .then((e) => {
        if (e) {
          setEvent(e);
          setStatus("ready");
        } else {
          setStatus("notFound");
        }
      })
      .catch(() => setStatus("notFound"));
  }, [eventId]);

  async function handleSubmit(values: EventFormValues) {
    if (!event) throw new Error("Event is still loading or missing.");
    const updated = await updateEvent(event.id, values);
    if (!updated) throw new Error("Could not save (event may have been deleted).");
    router.push(`/admin/events/${event.id}`);
  }

  if (status === "loading") {
    return (
      <div className="w-full rounded-lg border border-gray-700 bg-[#18181b] p-6">
        <p className="text-gray-400">Loading event…</p>
      </div>
    );
  }

  if (status === "notFound" || !event) {
    return (
      <div className="rounded-lg border border-gray-700 bg-[#18181b] p-6">
        <p className="text-gray-400">Event not found.</p>
        <button
          type="button"
          onClick={() => router.push("/admin/events")}
          className="mt-4 text-sm font-medium text-white hover:underline"
        >
          Back to Events
        </button>
      </div>
    );
  }

  const initialValues: Partial<EventFormValues> = {
    title: event.title,
    slug: event.slug,
    description: event.description,
    date: toDateInputValue(event.date),
    time: toTimeInputValue(event.time),
    venue: event.venue,
    address: event.address,
    prompt: event.prompt,
    heroImage: event.heroImage,
    heroImageMode: event.heroImageMode ?? "bw",
    landingHeadline:
      event.landingHeadline ?? "We're crowdsourcing a song for this event. Want to help create it?",
    landingCopy: event.landingCopy ?? "",
    ctaText: event.ctaText ?? "Let's make an anthem",
    anthemCompletionMessage:
      event.anthemCompletionMessage ??
      "Thanks! Your answers will help shape the song we're making.",
    agentThemeId: event.agentThemeId ?? null,
    agentBrief: event.agentBrief ?? null,
    songGardenConfig: event.songGardenConfig ?? undefined,
    journeySteps: event.journeySteps ?? undefined,
    worldConfig: event.worldConfig ?? null,
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold text-white">Edit Event</h2>
      <EventForm
        key={event.id}
        initialValues={initialValues}
        submitLabel="Save"
        submitSuccessMessage="Saved. Redirecting…"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
