"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { addEvent } from "@/data/eventsClient";

const LAST_CREATED_EVENT_KEY = "csc_last_created_event";

export default function NewEventPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: EventFormValues) {
    setError(null);
    try {
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
        heroImageMode: values.heroImageMode,
        landingHeadline: values.landingHeadline,
        landingCopy: values.landingCopy,
        ctaText: values.ctaText,
        anthemCompletionMessage: values.anthemCompletionMessage,
        agentThemeId: values.agentThemeId ?? null,
        agentBrief: values.agentBrief ?? null,
        songGardenConfig: values.songGardenConfig,
        journeySteps: values.journeySteps,
        worldConfig: values.worldConfig ?? null,
      });
      if (created) {
        sessionStorage.setItem(LAST_CREATED_EVENT_KEY, JSON.stringify(created));
        /* Redirect to list first so the list refetches from the same server that created the event; user can click the new event to open it. Avoids "Event not found" when multiple dev servers or caching is involved. */
        router.push("/admin/events?created=1");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      if (msg.includes("404")) {
        setError(
          "Create request failed (404). If you're using local events, set USE_LOCAL_EVENTS=true in .env.local, then stop the dev server (Ctrl+C) and run npm run dev again."
        );
      } else {
        setError(msg);
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold text-white">Create Event</h2>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <EventForm onSubmit={handleSubmit} />
    </div>
  );
}
