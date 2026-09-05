"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { addEvent } from "@/data/eventsClient";
import type { Garden, GardenChapter } from "@/lib/song-garden-v2/garden/types";

const LAST_CREATED_EVENT_KEY = "csc_last_created_event";

export default function NewGardenBloomPage() {
  const params = useParams();
  const router = useRouter();
  const gardenId = typeof params?.id === "string" ? params.id : "";
  const [garden, setGarden] = useState<Garden | null>(null);
  const [chapters, setChapters] = useState<GardenChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/gardens/${encodeURIComponent(gardenId)}`, {
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as {
          garden?: Garden;
          chapters?: GardenChapter[];
          error?: string;
        };
        if (!res.ok || !body.garden) {
          throw new Error(body.error || "Garden not found");
        }
        if (!cancelled) {
          setGarden(body.garden);
          setChapters(body.chapters ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load garden");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gardenId]);

  const nextIndex = useMemo(() => {
    const max = chapters.reduce((acc, c) => Math.max(acc, Number(c.index) || 0), 0);
    return max + 1;
  }, [chapters]);

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
      if (!created) throw new Error("Bloom create returned empty.");

      const chapterRes = await fetch(`/api/gardens/${encodeURIComponent(gardenId)}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: created.id,
          index: nextIndex,
          label: values.title.trim() || `Show ${nextIndex}`,
          status: "open",
        }),
      });
      const chapterBody = (await chapterRes.json().catch(() => ({}))) as { error?: string };
      if (!chapterRes.ok) {
        throw new Error(
          chapterBody.error ||
            "Bloom was created, but attaching it to this Song Garden failed. Attach it from the garden page."
        );
      }

      sessionStorage.setItem(LAST_CREATED_EVENT_KEY, JSON.stringify(created));
      router.push(`/admin/gardens/${gardenId}?bloomCreated=${encodeURIComponent(created.id)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      setError(msg);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading garden…</p>;
  }

  if (!garden) {
    return (
      <div className="space-y-3">
        <p className="text-gray-400">{error || "Garden not found."}</p>
        <Link href="/admin/gardens" className="text-sm text-[#CFFF81] hover:underline">
          ← Song Gardens
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          href={`/admin/gardens/${garden.id}`}
          className="text-sm text-gray-400 hover:text-white"
        >
          ← {garden.title}
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Bloom in garden
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">Create bloom</h1>
        <p className="mt-2 text-sm text-gray-400">
          This bloom becomes show #{nextIndex} in <span className="text-white">{garden.title}</span>.
          Same journey setup as a standalone bloom — it just lives in this Song Garden.
        </p>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      <EventForm onSubmit={handleSubmit} submitLabel="Create bloom in garden" />
    </div>
  );
}
