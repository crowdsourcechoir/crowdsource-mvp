"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, updateEvent, isStoredEvent, addEvent } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import EventForm, { type EventFormValues } from "@/components/EventForm";

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [event, setEvent] = useState<Event | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const e = getEventById(eventId);
    if (e) setEvent(e);
    else setNotFound(true);
  }, [eventId]);

  function handleSubmit(values: EventFormValues) {
    if (!event) return;
    if (isStoredEvent(event.id)) {
      updateEvent(event.id, values);
    } else {
      // Demo event: save as new stored event
      addEvent(values);
    }
    router.push(`/admin/events/${event.id}`);
  }

  if (notFound || !event) {
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
    date: event.date,
    time: event.time,
    venue: event.venue,
    address: event.address,
    prompt: event.prompt,
    heroImage: event.heroImage,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-2xl font-semibold text-white">Edit Event</h2>
      <EventForm
        initialValues={initialValues}
        submitLabel="Save"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
