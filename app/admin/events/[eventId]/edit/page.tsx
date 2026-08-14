"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getEventById, updateEvent } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { toDateInputValue, toTimeInputValue } from "@/lib/event-datetime-input";
import {
  clearEventFormDraft,
  draftMatchesBloom,
  journeyStepsHaveContent,
  readEventFormDraft,
  type EventFormDraft,
} from "@/lib/event-form-draft";
import { normalizeSongGardenConfig } from "@/lib/songgarden/config";

type LoadStatus = "loading" | "ready" | "notFound";

function buildInitialValues(
  event: Event,
  draft: EventFormDraft | null,
  useDraft: boolean
): Partial<EventFormValues> {
  const serverVibe = event.worldConfig?.aiArtworkPrompt?.trim() || "";
  const draftVibe = draft?.aiArtworkPrompt?.trim() || "";
  const vibe = serverVibe || draftVibe || null;
  const worldConfig = {
    ...(event.worldConfig ?? {
      title: "",
      heroArtworkUrl: null,
      logoUrl: null,
      primaryColor: "#1a0f2d",
      accentColor: "#CFFF81",
      animationPreset: "particles" as const,
      ambientSoundtrackUrl: null,
      aiArtworkPrompt: null,
      worldSceneStages: [],
      worldStoryboard: [],
      presenceSimulationEnabled: true,
    }),
    aiArtworkPrompt: vibe,
  };

  return {
    title: useDraft && draft?.title ? draft.title : event.title,
    slug: event.slug,
    description: useDraft && draft?.description ? draft.description : event.description,
    date: toDateInputValue(useDraft && draft?.date ? draft.date : event.date),
    time: toTimeInputValue(useDraft && draft?.time ? draft.time : event.time),
    venue: useDraft && draft?.venue ? draft.venue : event.venue,
    address: useDraft && draft?.address ? draft.address : event.address,
    prompt: useDraft && draft?.prompt ? draft.prompt : event.prompt,
    heroImage: event.heroImage,
    heroImageMode: event.heroImageMode ?? "bw",
    landingHeadline:
      (useDraft && draft?.landingHeadline) ||
      event.landingHeadline ||
      "We're crowdsourcing a song for this event. Want to help create it?",
    landingCopy: (useDraft && draft?.landingCopy) || event.landingCopy || "",
    ctaText: (useDraft && draft?.ctaText) || event.ctaText || "Let's make an anthem",
    anthemCompletionMessage:
      (useDraft && draft?.anthemCompletionMessage) ||
      event.anthemCompletionMessage ||
      "Thanks! Your answers will help shape the song we're making.",
    agentThemeId: (useDraft ? draft?.agentThemeId : null) ?? event.agentThemeId ?? null,
    agentBrief: (useDraft ? draft?.agentBrief : null) ?? event.agentBrief ?? null,
    songGardenConfig: useDraft && draft && journeyStepsHaveContent(draft.journeySteps)
      ? normalizeSongGardenConfig({
          ...(draft.songGardenConfig ?? { soundTransitionMessage: "", steps: [] }),
          journeySteps: draft.journeySteps,
        })
      : event.songGardenConfig ?? undefined,
    journeySteps:
      useDraft && draft && journeyStepsHaveContent(draft.journeySteps)
        ? draft.journeySteps
        : event.journeySteps ?? undefined,
    worldConfig,
  };
}

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = typeof params?.eventId === "string" ? params.eventId : "";
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [event, setEvent] = useState<Event | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<EventFormValues> | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const restoredPrompts = searchParams.get("restoredPrompts") === "1";

  useEffect(() => {
    setStatus("loading");
    setEvent(null);
    setInitialValues(null);
    setDraftNotice(null);
    getEventById(eventId)
      .then((e) => {
        if (!e) {
          setStatus("notFound");
          return;
        }
        setEvent(e);
        const serverHasPrompts = journeyStepsHaveContent(e.journeySteps);
        const draft = readEventFormDraft();
        const useDraft =
          !serverHasPrompts &&
          Boolean(draft) &&
          draftMatchesBloom(draft, { slug: e.slug, eventId: e.id }) &&
          journeyStepsHaveContent(draft?.journeySteps);
        const serverVibe = e.worldConfig?.aiArtworkPrompt?.trim() || "";
        const draftVibe = draft?.aiArtworkPrompt?.trim() || "";
        const restoredVibe = !serverVibe && Boolean(draftVibe);
        if (useDraft && restoredVibe) {
          setDraftNotice(
            "Restored your unsaved journey prompts and Runway vibe from this browser — hit Save to keep them on the bloom."
          );
        } else if (useDraft) {
          setDraftNotice(
            "Restored your unsaved journey prompts from this browser — hit Save to keep them on the bloom."
          );
        } else if (restoredVibe) {
          setDraftNotice(
            "Restored your unsaved Runway vibe prompt from this browser — click the vibe field then Save (or blur) to keep it."
          );
        } else if (restoredPrompts && serverHasPrompts) {
          setDraftNotice(
            "Journey prompts were restored with the world — review and Save if you change anything."
          );
        }
        setInitialValues(buildInitialValues(e, draft, useDraft));
        setStatus("ready");
      })
      .catch(() => setStatus("notFound"));
  }, [eventId, restoredPrompts]);

  async function handleSubmit(values: EventFormValues) {
    if (!event) throw new Error("Event is still loading or missing.");
    // Skip re-uploading an unchanged hero — data-URI heroes are multi‑MB and dominate save time.
    const payload: Partial<EventFormValues> = { ...values };
    if (payload.heroImage === event.heroImage) {
      delete payload.heroImage;
    }
    const updated = await updateEvent(event.id, payload);
    if (!updated) throw new Error("Could not save (event may have been deleted).");
    clearEventFormDraft();
    router.push(`/admin/events/${event.id}`);
  }

  if (status === "loading") {
    return (
      <div className="w-full rounded-lg border border-gray-700 bg-[#18181b] p-6">
        <p className="text-gray-400">Loading event…</p>
      </div>
    );
  }

  if (status === "notFound" || !event || !initialValues) {
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h2 className="mb-4 text-xl font-semibold text-white">Edit Event</h2>
      {draftNotice && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {draftNotice}
        </div>
      )}
      <EventForm
        key={`${event.id}-${journeyStepsHaveContent(initialValues.journeySteps) ? "prompts" : "empty"}`}
        eventId={event.id}
        initialValues={initialValues}
        submitLabel="Save"
        submitSuccessMessage="Saved. Redirecting…"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
