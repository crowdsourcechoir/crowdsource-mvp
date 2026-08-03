"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Event } from "@/data/mockEvents";
import type {
  Garden,
  GardenChapter,
  GardenEdition,
  GardenMutationRecord,
  GardenOrder,
  MerchFormat,
  WorldState,
} from "@/lib/song-garden-v2/garden/types";

type Props = { gardenId: string };

type DebugPayload = {
  worldState: WorldState;
  recentMutations: GardenMutationRecord[];
};

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
  const [debug, setDebug] = useState<DebugPayload | null>(null);
  const [histAt, setHistAt] = useState("");
  const [histPreview, setHistPreview] = useState<string | null>(null);
  const [editions, setEditions] = useState<GardenEdition[]>([]);
  const [orders, setOrders] = useState<GardenOrder[]>([]);
  const [editionSlug, setEditionSlug] = useState("");
  const [editionLabel, setEditionLabel] = useState("");
  const [orderFormat, setOrderFormat] = useState<MerchFormat>("square_print");
  const [orderEdition, setOrderEdition] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gRes, eRes, dRes, edRes, oRes] = await Promise.all([
        fetch(`/api/gardens/${gardenId}`, { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/debug?limit=30`, { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/editions`, { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/orders`, { cache: "no-store" }),
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

      if (dRes.ok) {
        const dBody = (await dRes.json()) as DebugPayload;
        setDebug({
          worldState: dBody.worldState,
          recentMutations: dBody.recentMutations ?? [],
        });
      }

      if (edRes.ok) {
        const edBody = (await edRes.json()) as { editions?: GardenEdition[] };
        setEditions(edBody.editions ?? []);
      }
      if (oRes.ok) {
        const oBody = (await oRes.json()) as { orders?: GardenOrder[] };
        setOrders(oBody.orders ?? []);
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

  async function handleFinalize(chapterId: string) {
    if (!confirm("Seal this chapter? Applies finale bloom and closes contributions for the show.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/chapters/${chapterId}/finalize`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Finalize failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalize failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleHistPreview() {
    setError(null);
    setHistPreview(null);
    try {
      const params = new URLSearchParams();
      if (histAt.trim()) params.set("at", new Date(histAt).toISOString());
      const res = await fetch(`/api/gardens/${gardenId}/snapshot?${params}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Historical snapshot failed");
      setHistPreview(JSON.stringify(body.state ?? body, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Historical snapshot failed");
    }
  }

  async function handlePinEdition(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/editions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editionSlug,
          label: editionLabel,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to pin edition");
      setEditionSlug("");
      setEditionLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pin edition");
    } finally {
      setSaving(false);
    }
  }

  async function handleStubOrder(kind: "living" | "edition") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          format: orderFormat,
          editionIdOrSlug: kind === "edition" ? orderEdition || undefined : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Stub order failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stub order failed");
    } finally {
      setSaving(false);
    }
  }

  if (!garden && !error) {
    return <p className="px-4 py-8 text-sm text-gray-500">Loading…</p>;
  }

  const attachedIds = new Set(chapters.map((c) => c.eventId));
  const availableEvents = events.filter((ev) => !attachedIds.has(ev.id));
  const publicHref = garden?.slug ? `/g/${garden.slug}` : null;

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
        {publicHref ? (
          <p className="mt-2 text-sm">
            <Link href={publicHref} className="text-[#CFFF81] underline">
              Public garden {publicHref}
            </Link>
            <span className="text-gray-500"> — between-show life</span>
          </p>
        ) : null}
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
                      · {ev?.title ?? c.eventId} · {c.status} · wt {c.chapterWeight}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {ev?.slug ? (
                      <Link href={`/e/${ev.slug}`} className="text-xs text-[#CFFF81] underline">
                        Open event
                      </Link>
                    ) : null}
                    {c.status !== "closed" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleFinalize(c.id)}
                        className="text-xs text-amber-300 underline disabled:opacity-50"
                      >
                        Seal finale
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">Sealed</span>
                    )}
                  </span>
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
                <span className="text-gray-600">
                  ({lm.key} · {lm.unlockedBy})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <h2 className="text-sm font-medium text-gray-200">Commerce (Phase C)</h2>
        <p className="text-xs text-gray-500">
          Pin monthly editions, preview deterministic merch art, and create stub checkout
          orders that freeze the print snapshot.
        </p>

        <form onSubmit={handlePinEdition} className="space-y-3 border-b border-gray-800 pb-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-500">Pin edition</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-400">
              Slug
              <input
                className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={editionSlug}
                onChange={(e) => setEditionSlug(e.target.value)}
                placeholder="2026-03"
                required
              />
            </label>
            <label className="block text-xs text-gray-400">
              Label
              <input
                className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={editionLabel}
                onChange={(e) => setEditionLabel(e.target.value)}
                placeholder="March 2026"
                required
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Pin current world
          </button>
        </form>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500">Editions</h3>
          {editions.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No editions pinned yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {editions.map((ed) => (
                <li
                  key={ed.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-800 px-3 py-2"
                >
                  <span>
                    <span className="text-white">{ed.label}</span>
                    <span className="text-gray-500">
                      {" "}
                      · /{ed.slug} · world v{ed.pinnedSnapshot.worldVersion}
                    </span>
                  </span>
                  <a
                    href={`/api/gardens/${gardenId}/merch/preview?format=square_print&edition=${ed.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#CFFF81] underline"
                  >
                    Preview PNG
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-800 pt-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-500">Stub checkout</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-gray-400">
              Format
              <select
                className="mt-1 block rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={orderFormat}
                onChange={(e) => setOrderFormat(e.target.value as MerchFormat)}
              >
                <option value="square_print">square_print</option>
                <option value="hoodie_front">hoodie_front</option>
                <option value="hoodie_allover">hoodie_allover</option>
              </select>
            </label>
            <label className="block text-xs text-gray-400">
              Edition (for edition order)
              <select
                className="mt-1 block rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={orderEdition}
                onChange={(e) => setOrderEdition(e.target.value)}
              >
                <option value="">Select…</option>
                {editions.map((ed) => (
                  <option key={ed.id} value={ed.slug}>
                    {ed.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleStubOrder("living")}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Order living one-of-one
            </button>
            <button
              type="button"
              disabled={saving || !orderEdition}
              onClick={() => void handleStubOrder("edition")}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Order pinned edition
            </button>
            <a
              href={`/api/gardens/${gardenId}/merch/preview?format=${orderFormat}&living=1`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-[#CFFF81]"
            >
              Living preview
            </a>
          </div>

          {orders.length ? (
            <ul className="space-y-2 text-xs text-gray-400">
              {orders.map((o) => (
                <li key={o.id} className="rounded border border-gray-800 px-2 py-1.5">
                  <span className="text-gray-200">{o.kind}</span> · {o.format} · {o.status} · v
                  {o.orderedSnapshot.worldVersion} · {new Date(o.createdAt).toLocaleString()}
                  {o.editionSlug ? ` · edition /${o.editionSlug}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No stub orders yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <h2 className="text-sm font-medium text-gray-200">World debugger</h2>
        <p className="text-xs text-gray-500">
          Live canonical state and recent mutations. Historical rebuild uses{" "}
          <code className="text-gray-400">?at=</code> replay.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-gray-400">
            Snapshot at (local datetime)
            <input
              type="datetime-local"
              className="mt-1 block rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={histAt}
              onChange={(e) => setHistAt(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleHistPreview()}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            Preview historical state
          </button>
        </div>

        {histPreview ? (
          <pre className="max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] text-gray-300">
            {histPreview}
          </pre>
        ) : null}

        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500">world_state</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] text-gray-300">
            {JSON.stringify(debug?.worldState ?? garden?.worldState ?? {}, null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500">recent mutations</h3>
          <ul className="mt-2 max-h-64 space-y-2 overflow-auto text-xs text-gray-400">
            {(debug?.recentMutations ?? []).map((m) => (
              <li key={m.id} className="rounded border border-gray-800 px-2 py-1.5">
                <span className="text-gray-300">v{m.worldVersion}</span> · {m.kind} · {m.sourceType}{" "}
                · {new Date(m.createdAt).toLocaleString()}
                {m.effects?.length ? (
                  <span className="text-gray-600">
                    {" "}
                    · {m.effects.map((e) => e.type).join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
            {!debug?.recentMutations?.length ? (
              <li className="text-gray-600">No mutations yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
