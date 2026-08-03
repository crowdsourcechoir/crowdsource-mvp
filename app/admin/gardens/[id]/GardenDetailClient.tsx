"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Event } from "@/data/mockEvents";
import type {
  Garden,
  GardenChapter,
  GardenEdition,
  GardenMutationRecord,
  GardenOrder,
  MerchFormat,
  SponsorDef,
  WorldState,
  ZoneDef,
} from "@/lib/song-garden-v2/garden/types";

type Props = { gardenId: string };

type DebugPayload = {
  worldState: WorldState;
  recentMutations: GardenMutationRecord[];
};

type ZoneDraft = {
  key: string;
  label: string;
  x: number;
  y: number;
  blurb: string;
  sponsorKey: string;
};

type SponsorDraft = {
  key: string;
  name: string;
};

const POSITION_PRESETS: Array<{ id: string; label: string; x: number; y: number }> = [
  { id: "nw", label: "Top left", x: 0.28, y: 0.22 },
  { id: "ne", label: "Top right", x: 0.72, y: 0.22 },
  { id: "c", label: "Center", x: 0.5, y: 0.5 },
  { id: "sw", label: "Bottom left", x: 0.28, y: 0.78 },
  { id: "se", label: "Bottom right", x: 0.72, y: 0.78 },
];

function slugifyKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function zonesFromGarden(garden: Garden | null): ZoneDraft[] {
  return (garden?.brandKit?.zones ?? []).map((z) => ({
    key: z.key,
    label: z.label,
    x: z.x,
    y: z.y,
    blurb: z.blurb ?? "",
    sponsorKey: z.sponsorKey ?? "",
  }));
}

function sponsorsFromGarden(garden: Garden | null): SponsorDraft[] {
  return (garden?.brandKit?.sponsors ?? []).map((s) => ({
    key: s.key,
    name: s.name,
  }));
}

export default function GardenDetailClient({ gardenId }: Props) {
  const [garden, setGarden] = useState<Garden | null>(null);
  const [chapters, setChapters] = useState<GardenChapter[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  const [zones, setZones] = useState<ZoneDraft[]>([]);
  const [sponsors, setSponsors] = useState<SponsorDraft[]>([]);
  const [mapImageUrl, setMapImageUrl] = useState("");
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [newZoneBlurb, setNewZoneBlurb] = useState("");
  const [newZonePreset, setNewZonePreset] = useState("nw");
  const [newSponsorName, setNewSponsorName] = useState("");
  const [shelfTitle, setShelfTitle] = useState("");
  const [shelfMoment, setShelfMoment] = useState("goal");
  const [shelfZone, setShelfZone] = useState("");
  const [readyItems, setReadyItems] = useState<
    Array<{
      id: string;
      title: string;
      momentType: string;
      zoneKey: string | null;
      status: string;
      payload: Record<string, unknown>;
    }>
  >([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gRes, eRes, dRes, edRes, oRes, shelfRes] = await Promise.all([
        fetch(`/api/gardens/${gardenId}`, { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/debug?limit=30`, { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/editions`, { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/orders`, { cache: "no-store" }),
        fetch(`/api/gardens/${gardenId}/ready-shelf`, { cache: "no-store" }),
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
      setZones(zonesFromGarden(gBody.garden ?? null));
      setSponsors(sponsorsFromGarden(gBody.garden ?? null));
      setMapImageUrl(gBody.garden?.brandKit?.heroArtworkUrl ?? "");

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
      if (shelfRes.ok) {
        const sBody = (await shelfRes.json()) as { items?: typeof readyItems };
        setReadyItems(sBody.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [gardenId]);

  useEffect(() => {
    void load();
  }, [load]);

  const zoneOptions = useMemo(
    () => zones.filter((z) => z.key.trim() && z.label.trim()),
    [zones]
  );

  async function handleAttach(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
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
      setNotice("Event attached.");
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
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json().catch(() => ({}))) as { garden?: Garden; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to update");
      setGarden(body.garden ?? null);
      setNotice("Status saved.");
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
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/chapters/${chapterId}/finalize`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Finalize failed");
      setNotice("Chapter sealed.");
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
    setNotice(null);
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
      setNotice("Edition pinned.");
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
    setNotice(null);
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
      setNotice("Stub order created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stub order failed");
    } finally {
      setSaving(false);
    }
  }

  function addZone() {
    const labelText = newZoneLabel.trim();
    if (!labelText) {
      setError("Give the zone a name first.");
      return;
    }
    const key = slugifyKey(labelText);
    if (!key) {
      setError("Zone name needs letters or numbers.");
      return;
    }
    if (zones.some((z) => z.key === key)) {
      setError(`A zone named like “${labelText}” already exists.`);
      return;
    }
    const preset = POSITION_PRESETS.find((p) => p.id === newZonePreset) ?? POSITION_PRESETS[0];
    setZones((prev) => [
      ...prev,
      {
        key,
        label: labelText,
        x: preset.x,
        y: preset.y,
        blurb: newZoneBlurb.trim(),
        sponsorKey: "",
      },
    ]);
    setNewZoneLabel("");
    setNewZoneBlurb("");
    setError(null);
    setNotice(`Added “${labelText}”. Tap Save map when you’re ready.`);
  }

  function removeZone(key: string) {
    setZones((prev) => prev.filter((z) => z.key !== key));
    if (shelfZone === key) setShelfZone("");
  }

  function addSponsor() {
    const name = newSponsorName.trim();
    if (!name) {
      setError("Give the sponsor a name first.");
      return;
    }
    const key = slugifyKey(name);
    if (!key) {
      setError("Sponsor name needs letters or numbers.");
      return;
    }
    if (sponsors.some((s) => s.key === key)) {
      setError(`Sponsor “${name}” is already on the list.`);
      return;
    }
    setSponsors((prev) => [...prev, { key, name }]);
    setNewSponsorName("");
    setError(null);
    setNotice(`Added sponsor “${name}”. Tap Save map when you’re ready.`);
  }

  async function handleSaveFansMap() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const nextZones: ZoneDef[] = zones
        .map((z) => ({
          key: slugifyKey(z.key || z.label),
          label: z.label.trim(),
          x: Math.min(1, Math.max(0, Number(z.x) || 0.5)),
          y: Math.min(1, Math.max(0, Number(z.y) || 0.5)),
          blurb: z.blurb.trim() || null,
          sponsorKey: z.sponsorKey.trim() || null,
        }))
        .filter((z) => z.key && z.label);

      const nextSponsors: SponsorDef[] = sponsors
        .map((s) => ({
          key: slugifyKey(s.key || s.name),
          name: s.name.trim(),
        }))
        .filter((s) => s.key && s.name);

      const res = await fetch(`/api/gardens/${gardenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandKit: {
            ...(garden?.brandKit ?? {}),
            heroArtworkUrl: mapImageUrl.trim() || null,
            zones: nextZones,
            sponsors: nextSponsors,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to save Fans map");
      setNotice("Fans map saved. Open the public garden to try it.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Fans map");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddReadyItem(promote: boolean) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/ready-shelf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: shelfTitle,
          momentType: shelfMoment,
          zoneKey: shelfZone || null,
          promote,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Ready shelf save failed");
      setShelfTitle("");
      setNotice(promote ? "Promoted to ready shelf." : "Added to ready shelf.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ready shelf save failed");
    } finally {
      setSaving(false);
    }
  }

  async function markPlayed(itemId: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/ready-shelf/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "played" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; item?: { status?: string } };
      if (!res.ok) throw new Error(body.error || "Could not mark as played");
      setReadyItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: "played" } : item))
      );
      setNotice("Marked as played on the checklist.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as played");
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-gray-100">
      <div>
        <Link href="/admin/gardens" className="text-xs text-gray-500 hover:underline">
          ← Gardens
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">{garden?.title ?? "Garden"}</h1>
        <p className="mt-1 text-sm text-gray-400">
          Live world · energy {(garden?.worldState?.energy ?? 0).toFixed(2)} ·{" "}
          {garden?.worldState?.totals?.contributions ?? 0} marks
        </p>
        {publicHref ? (
          <p className="mt-3">
            <Link
              href={publicHref}
              className="inline-flex rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black"
            >
              Open public garden
            </Link>
          </p>
        ) : null}
      </div>

      {error ? <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-[#CFFF81]/10 px-3 py-2 text-sm text-[#CFFF81]">{notice}</p>
      ) : null}

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
        <h2 className="text-sm font-medium text-gray-200">Shows (chapters)</h2>
        <p className="text-xs text-gray-500">Link live events so contributions grow this shared garden.</p>
        {chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No shows attached yet.</p>
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
                    <span className="text-white">{c.label}</span>
                    <span className="text-gray-500">
                      {" "}
                      · {ev?.title ?? c.eventId} · {c.status}
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
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Attach a show</h3>
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
              Show number
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
            {saving ? "Saving…" : "Attach show"}
          </button>
        </form>
      </section>

      {garden?.worldState?.landmarks?.length ? (
        <section className="rounded-xl border border-gray-800 bg-[#121214] p-4">
          <h2 className="text-sm font-medium text-gray-200">Landmarks unlocked</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            {garden.worldState.landmarks.map((lm) => (
              <li key={lm.id}>{lm.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <div>
          <h2 className="text-sm font-medium text-gray-200">Fan map</h2>
          <p className="mt-1 text-xs text-gray-500">
            Drop a team aerial or stadium map behind named sponsored zones fans can tap.
          </p>
        </div>

        <label className="block text-xs text-gray-400">
          Map image URL
          <input
            className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
            value={mapImageUrl}
            onChange={(e) => setMapImageUrl(e.target.value)}
            placeholder="/fans/ballard-fc/interbay-stadium-map.jpg"
          />
        </label>
        {mapImageUrl.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapImageUrl.trim()}
            alt=""
            className="max-h-40 w-full rounded-lg border border-gray-800 object-cover"
          />
        ) : null}

        {zones.length === 0 ? (
          <p className="text-sm text-gray-500">No zones yet. Add North End / South End to start.</p>
        ) : (
          <ul className="space-y-3">
            {zones.map((z) => (
              <li key={z.key} className="rounded-lg border border-gray-800 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{z.label}</p>
                    <p className="text-[11px] text-gray-500">id: {z.key}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeZone(z.key)}
                    className="text-xs text-red-300 underline"
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-2 block text-xs text-gray-400">
                  Short hint
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                    value={z.blurb}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((row) => (row.key === z.key ? { ...row, blurb: e.target.value } : row))
                      )
                    }
                    placeholder="Home roar"
                  />
                </label>
                <label className="mt-2 block text-xs text-gray-400">
                  Map spot
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                    value={
                      POSITION_PRESETS.find((p) => Math.abs(p.x - z.x) < 0.03 && Math.abs(p.y - z.y) < 0.03)
                        ?.id ?? "c"
                    }
                    onChange={(e) => {
                      const preset = POSITION_PRESETS.find((p) => p.id === e.target.value);
                      if (!preset) return;
                      setZones((prev) =>
                        prev.map((row) =>
                          row.key === z.key ? { ...row, x: preset.x, y: preset.y } : row
                        )
                      );
                    }}
                  >
                    {POSITION_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {sponsors.length ? (
                  <label className="mt-2 block text-xs text-gray-400">
                    Sponsor (optional)
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                      value={z.sponsorKey}
                      onChange={(e) =>
                        setZones((prev) =>
                          prev.map((row) =>
                            row.key === z.key ? { ...row, sponsorKey: e.target.value } : row
                          )
                        )
                      }
                    >
                      <option value="">None</option>
                      {sponsors.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-lg border border-dashed border-gray-700 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Add a zone</p>
          <label className="block text-xs text-gray-400">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={newZoneLabel}
              onChange={(e) => setNewZoneLabel(e.target.value)}
              placeholder="North End"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Hint (optional)
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={newZoneBlurb}
              onChange={(e) => setNewZoneBlurb(e.target.value)}
              placeholder="Home roar"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Map spot
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={newZonePreset}
              onChange={(e) => setNewZonePreset(e.target.value)}
            >
              {POSITION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addZone}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
          >
            Add zone
          </button>
        </div>

        <div className="space-y-3 border-t border-gray-800 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sponsors (optional)</p>
          {sponsors.length ? (
            <ul className="space-y-2 text-sm">
              {sponsors.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 px-3 py-2"
                >
                  <span className="text-white">{s.name}</span>
                  <button
                    type="button"
                    className="text-xs text-red-300 underline"
                    onClick={() => {
                      setSponsors((prev) => prev.filter((row) => row.key !== s.key));
                      setZones((prev) =>
                        prev.map((z) => (z.sponsorKey === s.key ? { ...z, sponsorKey: "" } : z))
                      );
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No sponsors yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={newSponsorName}
              onChange={(e) => setNewSponsorName(e.target.value)}
              placeholder="Acme Bank"
            />
            <button
              type="button"
              onClick={addSponsor}
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white"
            >
              Add sponsor
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveFansMap()}
          className="rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          Save map
        </button>

        {Object.keys(garden?.worldState?.zones ?? {}).length ? (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500">Zone energy</h3>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              {Object.entries(garden!.worldState.zones).map(([key, z]) => (
                <li key={key}>
                  <span className="text-gray-200">{key}</span> · {z.energy.toFixed(2)} energy ·{" "}
                  {z.contributions} marks
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <div>
          <h2 className="text-sm font-medium text-gray-200">Gameday checklist</h2>
          <p className="mt-1 text-xs text-gray-500">
            Queue moments for matchday. Marking played only updates this list — fans won’t see a
            change yet.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-gray-400">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={shelfTitle}
              onChange={(e) => setShelfTitle(e.target.value)}
              placeholder="North End kickoff swell"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Moment
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={shelfMoment}
              onChange={(e) => setShelfMoment(e.target.value)}
            >
              <option value="kickoff">kickoff</option>
              <option value="goal">goal</option>
              <option value="halftime">halftime</option>
              <option value="timeout">timeout</option>
              <option value="walkup">walkup</option>
              <option value="rivalry">rivalry</option>
              <option value="general">general</option>
            </select>
          </label>
          <label className="block text-xs text-gray-400 sm:col-span-2">
            Zone (optional)
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={shelfZone}
              onChange={(e) => setShelfZone(e.target.value)}
            >
              <option value="">None</option>
              {zoneOptions.map((z) => (
                <option key={z.key} value={z.key}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !shelfTitle.trim()}
            onClick={() => void handleAddReadyItem(false)}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Add to checklist
          </button>
          <button
            type="button"
            disabled={saving || !shelfTitle.trim()}
            onClick={() => void handleAddReadyItem(true)}
            className="rounded-lg border border-[#CFFF81]/40 px-3 py-2 text-sm text-[#CFFF81] disabled:opacity-50"
          >
            Add with world snapshot
          </button>
        </div>

        {readyItems.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing on the checklist yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {readyItems.map((item) => {
              const zoneLabel =
                zoneOptions.find((z) => z.key === item.zoneKey)?.label ?? item.zoneKey;
              const played = item.status === "played";
              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-3 ${
                    played ? "border-[#CFFF81]/30 bg-[#CFFF81]/5" : "border-gray-800"
                  }`}
                >
                  <span>
                    <span className="text-white">{item.title}</span>
                    <span className="text-gray-500">
                      {" "}
                      · {item.momentType}
                      {zoneLabel ? ` · ${zoneLabel}` : ""}
                    </span>
                  </span>
                  {played ? (
                    <span className="rounded-full bg-[#CFFF81]/15 px-2.5 py-1 text-xs font-medium text-[#CFFF81]">
                      Played ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void markPlayed(item.id)}
                      className="rounded-lg bg-amber-400/90 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Mark played"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="rounded-xl border border-gray-800 bg-[#121214] p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-300">
          Advanced · Commerce & debugger
        </summary>
        <div className="mt-4 space-y-8">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-200">Commerce</h2>
            <p className="text-xs text-gray-500">
              Pin editions, preview merch art, and create stub checkout orders.
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
          </div>

          <div className="space-y-4 border-t border-gray-800 pt-6">
            <h2 className="text-sm font-medium text-gray-200">World debugger</h2>
            <p className="text-xs text-gray-500">Live state and recent mutations for engineering checks.</p>

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
          </div>
        </div>
      </details>
    </div>
  );
}
