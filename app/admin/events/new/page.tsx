"use client";

import { useRouter } from "next/navigation";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { addEvent } from "@/data/eventsClient";

export default function NewEventPage() {
  const router = useRouter();

  async function handleSubmit(values: EventFormValues) {
    const created = await addEvent({
      slug: values.slug,
      title: values.title,
      description: values.description,
      date: values.date,
      time: values.time,
      venue: values.venue,
      address: values.address,
      prompt: values.prompt,
      heroImage: values.heroImage,
    });
    if (created) router.push("/admin/events");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 text-2xl font-semibold text-white">Create Event</h2>
      <EventForm onSubmit={handleSubmit} />
    </div>
  );
}
