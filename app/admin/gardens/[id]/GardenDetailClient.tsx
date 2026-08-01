"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Event } from "@/data/mockEvents";
import type { Garden, GardenChapter } from "@/lib/song-garden-v2/garden/types";

type Props = { gardenId: string };

export default function GardenDetailClient({ gardenId }: Props) {
  const [garden, setGarden] = useState<Garden | null>(null);
  const [chapters, setChapters] = useState<GardenChapter[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [index, setIndex] = useState("1");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Garden["status"]>("live");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gRes, eRes] = await Promise.all([
        fetch(`/api/gardens/${gardenId}`, { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
      ]);
      const gBody = (await gRes.json().catch(() => ({}))) as {
        garden?: Garden;
        chapters?: GardenChapter[];
        error?: string;
      };
      if (!gRes.ok) throw new Error(gBody.error || "Failed to load garden");
      setGarden(gBody.garden ?? null);
      setChapters(gBody.chapters ?? []);
      setStatus(gBody.garden?.status ?? "live");

      if (eRes.ok) {
        const list = (await eRes.json()) as Event[];
        setEvents(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [gardenId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAttach(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          index: Number(index),
          label: label.trim() || undefined,
          status: "open",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to attach chapter");
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json().catch(() => ({}))) as { garden?: Garden; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update");
      setGarden(body.garden ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  if (!garden && !error) {
    return <p className="px-4 py-8 text-sm text-gray-500">Loading…</p>;
  }

  const attachedIds = new Set(chapters.map((c) => c.eventId));
  const availableEvents = events.filter((ev) => !attachedIds.has(ev.id));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-gray-100">
      <div>
        <Link href="/admin/gardens" className="text-xs text-gray-500 hover:underline">
          ← Gardens
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">{garden?.title ?? "Garden"}</h1>
        <p className="mt-1 text-sm text-gray-400">
          /{garden?.slug} · world v{garden?.worldVersion ?? 0} · energy{" "}
          {(garden?.worldState?.energy ?? 0).toFixed(3)} ·{" "}
          {garden?.worldState?.totals?.contributions ?? 0} contributions
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <h2 className="text-sm font-medium text-gray-200">Status</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as Garden["status"])}
          >
            <option value="draft">draft</option>
            <option value="live">live</option>
            <option value="archived">archived</option>
          </select>
          <button
            type="button"
            onClick={() => void handleStatusSave()}
            disabled={saving}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <h2 className="text-sm font-medium text-gray-200">Chapters (events)</h2>
        {chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No chapters yet. Attach an event below.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {chapters.map((c) => {
              const ev = events.find((e) => e.id === c.eventId);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 px-3 py-2"
                >
                  <span>
                    <span className="text-gray-500">#{c.index}</span>{" "}
                    <span className="text-white">{c.label}</span>
                    <span className="text-gray-500">
                      {" "}
                      · {ev?.title ?? c.eventId} · {c.status}
                    </span>
                  </span>
                  {ev?.slug ? (
                    <Link href={`/e/${ev.slug}`} className="text-xs text-[#CFFF81] underline">
                      Open event
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleAttach} className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Attach event
          </h3>
          <label className="block text-xs text-gray-400">
            Event
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
            >
              <option value="">Select event…</option>
              {availableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.slug})
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-400">
              Show index
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={index}
                onChange={(e) => setIndex(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs text-gray-400">
              Label
              <input
                className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Show 1"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !eventId}
            className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Attach chapter"}
          </button>
        </form>
      </section>

      {garden?.worldState?.landmarks?.length ? (
        <section className="rounded-xl border border-gray-800 bg-[#121214] p-4">
          <h2 className="text-sm font-medium text-gray-200">Landmarks unlocked</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            {garden.worldState.landmarks.map((lm) => (
              <li key={lm.id}>
                {lm.label}{" "}
                <span className="text-gray-600">({lm.key})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
