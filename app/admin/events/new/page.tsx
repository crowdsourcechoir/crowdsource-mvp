"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { addEvent } from "@/data/eventsClient";
import type { Garden } from "@/lib/song-garden-v2/garden/types";

const LAST_CREATED_EVENT_KEY = "csc_last_created_event";

export default function NewEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const standalone = searchParams.get("standalone") === "1";
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [loadingGardens, setLoadingGardens] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGardens = useCallback(async () => {
    setLoadingGardens(true);
    try {
      const res = await fetch("/api/gardens", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        gardens?: Garden[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to load Song Gardens");
      setGardens(body.gardens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Song Gardens");
    } finally {
      setLoadingGardens(false);
    }
  }, []);

  useEffect(() => {
    if (!standalone) void loadGardens();
  }, [standalone, loadGardens]);

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
        router.push(`/admin/events/${created.id}?created=1`);
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

  if (standalone) {
    return (
      <div className="w-full">
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Standalone bloom (no Song Garden yet)</p>
          <p className="mt-1 text-amber-200/80">
            Prefer creating inside a Song Garden so the bloom belongs to a world from day one.{" "}
            <Link href="/admin/events/new" className="underline hover:text-white">
              Pick a garden instead
            </Link>
            .
          </p>
        </div>
        <h2 className="mb-4 text-xl font-semibold text-white">Create bloom</h2>
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <EventForm onSubmit={handleSubmit} submitLabel="Create bloom" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Create</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Create bloom in a Song Garden</h1>
        <p className="mt-2 text-sm text-gray-400">
          Always start with a Song Garden, then add the bloom inside it — same journey setup as
          before, attached to the world from the start.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-white/10 p-5">
        <h2 className="text-sm font-medium text-gray-200">Pick a Song Garden</h2>
        {loadingGardens ? (
          <p className="text-sm text-gray-500">Loading gardens…</p>
        ) : gardens.length === 0 ? (
          <div className="space-y-3 text-sm text-gray-400">
            <p>No Song Gardens yet. Create one first, then add your bloom.</p>
            <Link
              href="/admin/gardens/new"
              className="inline-flex rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black"
            >
              + Create Song Garden
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {gardens.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{g.title}</p>
                  <p className="text-xs text-gray-500">
                    /g/{g.slug} · {g.status}
                  </p>
                </div>
                <Link
                  href={`/admin/gardens/${g.id}/blooms/new`}
                  className="rounded-lg bg-[#CFFF81] px-3 py-2 text-xs font-semibold text-black"
                >
                  + Bloom here
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-2">
          <Link href="/admin/gardens/new" className="text-sm text-[#CFFF81] hover:underline">
            + Create a new Song Garden first
          </Link>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Rare: need a bloom with no garden yet?{" "}
        <Link href="/admin/events/new?standalone=1" className="text-gray-400 underline hover:text-white">
          Create standalone
        </Link>
      </p>
    </div>
  );
}
