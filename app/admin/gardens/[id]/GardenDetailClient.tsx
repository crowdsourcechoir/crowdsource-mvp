"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/data/mockEvents";
import ZoneMapEditor from "@/components/song-garden-v2/ZoneMapEditor";
import GardenCompositionCanvas from "@/components/song-garden-v2/GardenCompositionCanvas";
import { publicEventPath } from "@/lib/event-slug-aliases";
import type {
  Garden,
  GardenChapter,
  GardenEdition,
  GardenMutationRecord,
  GardenOrder,
  MapPlateVariant,
  MapPlateVariantKey,
  MerchFormat,
  SponsorDef,
  WorldState,
  ZoneDef,
  ZoneHitRegion,
} from "@/lib/song-garden-v2/garden/types";
import {
  MAP_PLATE_VARIANT_KEYS,
  MAP_PLATE_VARIANT_LABELS,
} from "@/lib/song-garden-v2/garden/types";
import FileDropZone from "@/components/ui/FileDropZone";
import { confirmRareDelete } from "@/lib/confirm-rare-delete";

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
  prompt: string;
  ctaLabel: string;
  inputPlaceholder: string;
  logoUrl: string;
  hit: ZoneHitRegion | null;
};

type SponsorDraft = {
  key: string;
  name: string;
  logoUrl: string;
  credit: string;
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
    prompt: z.prompt ?? "",
    ctaLabel: z.ctaLabel ?? "",
    inputPlaceholder: z.inputPlaceholder ?? "",
    logoUrl: z.logoUrl ?? "",
    hit: z.hit ?? { type: "circle", r: 0.08 },
  }));
}

function sponsorsFromGarden(garden: Garden | null): SponsorDraft[] {
  return (garden?.brandKit?.sponsors ?? []).map((s) => ({
    key: s.key,
    name: s.name,
    logoUrl: s.logoUrl ?? "",
    credit: s.credit ?? "",
  }));
}

export default function GardenDetailClient({ gardenId }: Props) {
  const router = useRouter();
  const [garden, setGarden] = useState<Garden | null>(null);
  const [chapters, setChapters] = useState<GardenChapter[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [index, setIndex] = useState("1");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [mapRefs, setMapRefs] = useState<string[]>([]);
  const [mapVibe, setMapVibe] = useState("");
  const [mapVenueNotes, setMapVenueNotes] = useState("");
  const [mapSeasonLabel, setMapSeasonLabel] = useState("");
  const [mapDraftUrl, setMapDraftUrl] = useState<string | null>(null);
  const [mapPinnedAt, setMapPinnedAt] = useState<string | null>(null);
  const [mapLayoutGuided, setMapLayoutGuided] = useState(true);
  const [mapTwinMode, setMapTwinMode] = useState(true);
  const [mapAmbientVideoUrl, setMapAmbientVideoUrl] = useState<string | null>(null);
  const [mapVariants, setMapVariants] = useState<MapPlateVariant[]>([]);
  const [mapActiveVariant, setMapActiveVariant] = useState<MapPlateVariantKey | "default">(
    "default"
  );
  const [uploadingRefs, setUploadingRefs] = useState(false);
  /** `zone:key` or `sponsor:key` while a logo file is uploading. */
  const [uploadingLogoKey, setUploadingLogoKey] = useState<string | null>(null);
  const [generatingPlate, setGeneratingPlate] = useState(false);
  const [pinningPlate, setPinningPlate] = useState(false);
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [generatingVariantKey, setGeneratingVariantKey] = useState<string | null>(null);
  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
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
      const plate = gBody.garden?.brandKit?.mapPlate;
      setMapRefs(plate?.referenceUrls?.length ? [...plate.referenceUrls] : [""]);
      setMapVibe(plate?.vibePrompt ?? "");
      setMapVenueNotes(plate?.venueNotes ?? "");
      setMapSeasonLabel(plate?.seasonLabel ?? "");
      setMapDraftUrl(plate?.draftUrl ?? null);
      setMapPinnedAt(plate?.pinnedAt ?? null);
      setMapLayoutGuided(plate?.layoutGuided ?? true);
      setMapTwinMode(plate?.twinMode !== false);
      setMapAmbientVideoUrl(plate?.ambientVideoUrl ?? null);
      setMapVariants(plate?.variants ?? []);
      setMapActiveVariant(plate?.activeVariantKey ?? "default");

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

  async function handleDeleteGarden() {
    if (!garden || deleting) return;
    if (!confirmRareDelete("garden", garden.title)) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${encodeURIComponent(garden.id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Delete failed");
      router.push("/admin/gardens");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete garden.");
      setDeleting(false);
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
        prompt: "",
        ctaLabel: "",
        inputPlaceholder: "",
        logoUrl: "",
        hit: { type: "circle", r: 0.08 },
      },
    ]);
    setSelectedZoneKey(key);
    setNewZoneLabel("");
    setNewZoneBlurb("");
    setError(null);
    setNotice(`Added “${labelText}”. Tap Save map when you’re ready.`);
  }

  function removeZone(key: string) {
    setZones((prev) => prev.filter((z) => z.key !== key));
    if (shelfZone === key) setShelfZone("");
    if (selectedZoneKey === key) setSelectedZoneKey(null);
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
    setSponsors((prev) => [...prev, { key, name, logoUrl: "", credit: "" }]);
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
          prompt: z.prompt.trim() || null,
          ctaLabel: z.ctaLabel.trim() || null,
          inputPlaceholder: z.inputPlaceholder.trim() || null,
          logoUrl: z.logoUrl.trim() || null,
          hit: z.hit,
        }))
        .filter((z) => z.key && z.label);

      const nextSponsors: SponsorDef[] = sponsors
        .map((s) => ({
          key: slugifyKey(s.key || s.name),
          name: s.name.trim(),
          logoUrl: s.logoUrl.trim() || null,
          credit: s.credit.trim() || null,
        }))
        .filter((s) => s.key && s.name);

      const referenceUrls = mapRefs.map((u) => u.trim()).filter(Boolean);

      const res = await fetch(`/api/gardens/${gardenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandKit: {
            ...(garden?.brandKit ?? {}),
            heroArtworkUrl: mapImageUrl.trim() || null,
            zones: nextZones,
            sponsors: nextSponsors,
            mapPlate: {
              ...(garden?.brandKit?.mapPlate ?? {}),
              referenceUrls,
              vibePrompt: mapVibe.trim(),
              venueNotes: mapVenueNotes.trim(),
              seasonLabel: mapSeasonLabel.trim(),
              draftUrl: mapDraftUrl,
              draftGeneratedAt: garden?.brandKit?.mapPlate?.draftGeneratedAt ?? null,
              pinnedAt: mapPinnedAt,
              layoutGuided: mapLayoutGuided,
              twinMode: mapTwinMode,
              ambientVideoUrl: mapAmbientVideoUrl,
              variants: mapVariants,
              activeVariantKey: mapActiveVariant === "default" ? null : mapActiveVariant,
            },
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

  async function handleUploadLogoFiles(
    kind: "zone" | "sponsor",
    key: string,
    picked: File[]
  ) {
    if (picked.length === 0 || !key.trim()) return;

    const MAX_LOGO_BYTES = 8 * 1024 * 1024;
    const isImageFile = (f: File) =>
      f.type.startsWith("image/") ||
      f.type === "image/svg+xml" ||
      (!f.type && /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name));

    const file = picked.find(isImageFile);
    if (!file) {
      setError("That file didn’t look like an image. Use PNG, JPEG, WebP, or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`“${file.name}” is over 8MB. Compress it and try again.`);
      return;
    }

    const uploadToken = `${kind}:${key}`;
    setUploadingLogoKey(uploadToken);
    setError(null);
    setNotice(null);
    try {
      const prepareRes = await fetch(`/api/gardens/${gardenId}/logos/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          key,
          files: [
            {
              name: file.name,
              contentType: file.type?.startsWith("image/") ? file.type : "image/png",
              size: file.size,
            },
          ],
        }),
      });
      const prepareBody = (await prepareRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        uploads?: Array<{ signedUrl: string; publicUrl: string; contentType: string }>;
      };

      if (!prepareRes.ok || !prepareBody.uploads?.[0]) {
        // Local / no-storage fallback: small data URL so Joel can still preview.
        if (prepareBody.code === "not_configured" && file.size <= 1.5 * 1024 * 1024) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Could not read file."));
            reader.readAsDataURL(file);
          });
          if (kind === "zone") {
            setZones((prev) =>
              prev.map((row) => (row.key === key ? { ...row, logoUrl: dataUrl } : row))
            );
          } else {
            setSponsors((prev) =>
              prev.map((row) => (row.key === key ? { ...row, logoUrl: dataUrl } : row))
            );
          }
          setNotice("Logo attached locally (storage not configured). Save map to keep it.");
          return;
        }
        throw new Error(prepareBody.error || "Could not prepare logo upload.");
      }

      const upload = prepareBody.uploads[0];
      const put = await fetch(upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.contentType },
        body: file,
      });
      if (!put.ok) {
        const detail = await put.text().catch(() => "");
        throw new Error(
          `Could not upload “${file.name}”${detail ? `: ${detail.slice(0, 120)}` : "."}`
        );
      }

      if (kind === "zone") {
        setZones((prev) =>
          prev.map((row) => (row.key === key ? { ...row, logoUrl: upload.publicUrl } : row))
        );
      } else {
        setSponsors((prev) =>
          prev.map((row) => (row.key === key ? { ...row, logoUrl: upload.publicUrl } : row))
        );
      }
      setNotice("Logo uploaded. Save map to publish it on /g.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploadingLogoKey(null);
    }
  }

  async function handleUploadMapRefFiles(picked: File[]) {
    if (picked.length === 0) return;

    const MAX_REF_BYTES = 20 * 1024 * 1024;
    const isImageFile = (f: File) =>
      f.type.startsWith("image/") ||
      (!f.type && /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name));

    const files = picked.filter(isImageFile);
    if (files.length === 0) {
      setError(
        "That file didn’t look like an image. Use JPEG, PNG, or WebP (HEIC may need converting)."
      );
      return;
    }
    if (files.length < picked.length) {
      setNotice("Skipped non-image files. Uploading the rest…");
    }

    const filled = mapRefs.map((u) => u.trim()).filter(Boolean);
    const room = Math.max(0, 8 - filled.length);
    if (room === 0) {
      setError("Already at 8 references. Remove one before uploading more.");
      return;
    }
    const batch = files.slice(0, room);
    for (const file of batch) {
      if (file.size > MAX_REF_BYTES) {
        setError(`“${file.name}” is over 20MB. Compress it and try again.`);
        return;
      }
    }

    setUploadingRefs(true);
    setError(null);
    setNotice(null);
    try {
      // Direct-to-storage signed upload (bypasses Vercel ~4.5MB body limit).
      const prepareRes = await fetch(`/api/gardens/${gardenId}/map-plate/refs/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: batch.map((file) => ({
            name: file.name,
            contentType: file.type?.startsWith("image/") ? file.type : "image/jpeg",
            size: file.size,
          })),
        }),
      });
      const prepareBody = (await prepareRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        uploads?: Array<{
          signedUrl: string;
          publicUrl: string;
          contentType: string;
        }>;
      };

      let urls: string[] = [];

      if (prepareRes.ok && prepareBody.uploads?.length) {
        for (let i = 0; i < prepareBody.uploads.length; i += 1) {
          const upload = prepareBody.uploads[i];
          const file = batch[i];
          const put = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: file,
          });
          if (!put.ok) {
            const detail = await put.text().catch(() => "");
            throw new Error(
              `Could not upload “${file.name}” to storage${detail ? `: ${detail.slice(0, 120)}` : "."}`
            );
          }
          urls.push(upload.publicUrl);
        }
      } else if (prepareBody.code === "not_configured") {
        // Local/dev fallback: data-URLs only work under ~4.5MB on Vercel.
        const small = batch.filter((f) => f.size <= 4.5 * 1024 * 1024);
        if (small.length === 0) {
          throw new Error(
            "Storage isn’t configured and files are over ~4.5MB. Configure Supabase storage for 20MB uploads."
          );
        }
        urls = [];
        const images = await Promise.all(
          small.map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  if (typeof result === "string" && result.startsWith("data:")) resolve(result);
                  else reject(new Error(`Could not read “${file.name}”.`));
                };
                reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
                reader.readAsDataURL(file);
              })
          )
        );
        const res = await fetch(`/api/gardens/${gardenId}/map-plate/refs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images, append: true }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          referenceUrls?: string[];
          urls?: string[];
        };
        if (!res.ok) throw new Error(body.error || "Upload failed");
        const next = body.referenceUrls?.length
          ? body.referenceUrls
          : [...filled, ...(body.urls ?? [])];
        setMapRefs(next.length ? next : [""]);
        setNotice(
          `Uploaded ${body.urls?.length ?? small.length} reference photo${
            (body.urls?.length ?? small.length) === 1 ? "" : "s"
          }. #1 is the venue lock — use Move up if needed.`
        );
        await load();
        return;
      } else {
        throw new Error(prepareBody.error || "Could not prepare upload.");
      }

      const res = await fetch(`/api/gardens/${gardenId}/map-plate/refs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, append: true }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        referenceUrls?: string[];
        urls?: string[];
      };
      if (!res.ok) throw new Error(body.error || "Upload failed");
      const next = body.referenceUrls?.length
        ? body.referenceUrls
        : [...filled, ...(body.urls ?? urls)];
      setMapRefs(next.length ? next : [""]);
      setNotice(
        `Uploaded ${body.urls?.length ?? urls.length} reference photo${
          (body.urls?.length ?? urls.length) === 1 ? "" : "s"
        }. #1 is the venue lock — use Move up if needed.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingRefs(false);
    }
  }

  function moveMapRef(index: number, dir: -1 | 1) {
    setMapRefs((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  async function handleGenerateMapPlate() {
    setGeneratingPlate(true);
    setError(null);
    setNotice(null);
    try {
      const referenceUrls = mapRefs.map((u) => u.trim()).filter(Boolean);
      const res = await fetch(`/api/gardens/${gardenId}/map-plate/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibePrompt: mapVibe.trim(),
          venueNotes: mapVenueNotes.trim(),
          referenceUrls,
          seasonLabel: mapSeasonLabel.trim(),
          layoutGuided: mapLayoutGuided,
          twinMode: mapTwinMode,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        draftUrl?: string;
        layoutGuided?: boolean;
        twinMode?: boolean;
        garden?: Garden;
      };
      if (!res.ok) throw new Error(body.error || "Failed to generate map plate");
      setMapDraftUrl(body.draftUrl ?? body.garden?.brandKit?.mapPlate?.draftUrl ?? null);
      if (body.garden) setGarden(body.garden);
      setNotice(
        body.twinMode
          ? "Digital-twin draft ready — should read as this stadium, game-world stylized. Pin when it feels right."
          : body.layoutGuided
            ? "Layout-guided draft ready. Preview, then Pin for season. Zone hits stay put."
            : "Draft season map ready. Preview below, then Pin for season."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate map plate");
    } finally {
      setGeneratingPlate(false);
    }
  }

  async function handlePinMapPlate() {
    if (!mapDraftUrl?.trim() && !mapImageUrl.trim()) {
      setError("Generate a draft (or set a map URL) before pinning.");
      return;
    }
    const replacing = Boolean(mapPinnedAt && garden?.brandKit?.heroArtworkUrl);
    if (replacing) {
      const ok = window.confirm(
        "Replace the pinned season map plate? Zone hit regions will stay; ambient motion will clear until you regenerate it."
      );
      if (!ok) return;
    }
    setPinningPlate(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/map-plate/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mapDraftUrl?.trim() || mapImageUrl.trim() || undefined,
          seasonLabel: mapSeasonLabel.trim() || undefined,
          confirmReplace: replacing,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        plateUrl?: string;
        garden?: Garden;
      };
      if (!res.ok) throw new Error(body.error || "Failed to pin map plate");
      if (body.plateUrl) setMapImageUrl(body.plateUrl);
      setNotice("Season map plate pinned. Public /g uses this art until you pin again.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pin map plate");
    } finally {
      setPinningPlate(false);
    }
  }

  async function handleGenerateMotion() {
    setGeneratingMotion(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/map-plate/motion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        ambientVideoUrl?: string;
      };
      if (!res.ok) throw new Error(body.error || "Failed to generate ambient motion");
      setMapAmbientVideoUrl(body.ambientVideoUrl ?? null);
      setNotice("Ambient loop ready — /g will play it over the pinned plate.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ambient motion");
    } finally {
      setGeneratingMotion(false);
    }
  }

  async function handleGenerateVariant(key: Exclude<MapPlateVariantKey, "default">) {
    setGeneratingVariantKey(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/map-plate/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, withMotion: false }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        variant?: MapPlateVariant;
      };
      if (!res.ok) throw new Error(body.error || "Failed to generate variant");
      setNotice(`${MAP_PLATE_VARIANT_LABELS[key]} variant ready. Activate it for /g when you want.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate variant");
    } finally {
      setGeneratingVariantKey(null);
    }
  }

  async function handleSetActiveVariant(key: MapPlateVariantKey | "default") {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/map-plate/variants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeVariantKey: key === "default" ? null : key,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to set active variant");
      setMapActiveVariant(key);
      setNotice(
        key === "default"
          ? "Showing default season plate on /g."
          : `Showing ${MAP_PLATE_VARIANT_LABELS[key]} on /g.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set active variant");
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

      <section className="space-y-3 rounded-xl border border-white/10 bg-transparent p-4">
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
            disabled={saving || deleting}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-red-900/50 bg-transparent p-4">
        <h2 className="text-sm font-medium text-red-200">Delete garden</h2>
        <p className="text-xs text-gray-500">
          Rare. Removes this world and its map, chapters, and merch records. Linked blooms stay in
          the Blooms list. You will be asked twice.
        </p>
        <button
          type="button"
          disabled={deleting || !garden}
          onClick={() => void handleDeleteGarden()}
          className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/40 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete garden"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-transparent p-4">
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
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
                      <Link href={publicEventPath(ev.slug)} className="text-xs text-[#CFFF81] underline">
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

        <form onSubmit={handleAttach} className="mt-4 space-y-3 border-t border-white/10 pt-4">
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
        <section className="rounded-xl border border-white/10 bg-transparent p-4">
          <h2 className="text-sm font-medium text-gray-200">Landmarks unlocked</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-400">
            {garden.worldState.landmarks.map((lm) => (
              <li key={lm.id}>{lm.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-white/10 bg-transparent p-4">
        <div>
          <h2 className="text-sm font-medium text-gray-200">Fan map</h2>
          <p className="mt-1 text-xs text-gray-500">
            Generate a season map plate, pin it once, then place named sponsored zones fans can tap.
            Regenerating a draft does not move hit regions.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Season map plate
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">
              M1 pin · M2 layout-guided · M3 ambient loop · M4 matchday variants. Public{" "}
              <code className="text-gray-400">/g</code> uses the active still (and loop if set).
            </p>
          </div>

          <label className="block text-xs text-gray-400">
            Season label
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={mapSeasonLabel}
              onChange={(e) => setMapSeasonLabel(e.target.value)}
              placeholder="2026 season"
            />
          </label>

          <label className="block text-xs text-gray-400">
            Vibe prompt
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={mapVibe}
              onChange={(e) => setMapVibe(e.target.value)}
              placeholder="Interbay night matchday, deep navy pitch, chartreuse accents, Pacific Northwest mist…"
            />
          </label>

          <label className="block text-xs text-gray-400">
            Venue landmarks (digital twin cues)
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={mapVenueNotes}
              onChange={(e) => setMapVenueNotes(e.target.value)}
              placeholder="Horizontal pitch; west parking; north concessions strip; east beer garden; south stand; surrounding trees…"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={mapTwinMode}
              onChange={(e) => setMapTwinMode(e.target.checked)}
              className="rounded border-gray-600"
            />
            Digital twin — lock THIS community pitch from the first aerial (no inventing a stadium bowl)
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={mapLayoutGuided}
              onChange={(e) => setMapLayoutGuided(e.target.checked)}
              className="rounded border-gray-600"
            />
            Layout-guided — zone positions in the prompt (twin mode skips the schematic image so it won’t invent a bowl)
          </label>

          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              References — <span className="text-gray-300">#1 = venue lock</span> (real aerial /
              map). Upload photos up to 20MB each, or paste URLs. Optional clean Google Earth shot as
              #2.
            </p>

            <div className="space-y-2">
              <FileDropZone
                accept="image/*,.heic,.heif,.avif"
                multiple
                disabled={uploadingRefs || saving}
                onFiles={(files) => void handleUploadMapRefFiles(files)}
                label={uploadingRefs ? "Uploading…" : "Drop venue photos here, or click to browse"}
                hint="JPEG, PNG, WebP · up to 20MB each · max 8 total"
                variant="panel"
              />
              {mapRefs.filter((u) => u.trim()).length < 8 ? (
                <button
                  type="button"
                  className="text-xs text-gray-400 underline"
                  onClick={() => setMapRefs((prev) => [...prev, ""])}
                >
                  Add URL field
                </button>
              ) : null}
            </div>

            {mapRefs.map((url, i) => (
              <div
                key={`ref-${i}`}
                className="flex flex-wrap items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2"
              >
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-start">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    #{i + 1}
                    {i === 0 ? " · venue" : ""}
                  </span>
                  {url.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url.trim()}
                      alt=""
                      className="h-14 w-20 rounded border border-gray-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded border border-dashed border-gray-700 text-[10px] text-gray-600">
                      empty
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                    value={url}
                    onChange={(e) =>
                      setMapRefs((prev) => prev.map((row, j) => (j === i ? e.target.value : row)))
                    }
                    placeholder="/fans/ballard-fc/interbay-stadium-map.jpg"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-gray-400 underline disabled:opacity-40"
                      disabled={i === 0}
                      onClick={() => moveMapRef(i, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-gray-400 underline disabled:opacity-40"
                      disabled={i >= mapRefs.length - 1}
                      onClick={() => moveMapRef(i, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-red-300 underline"
                      onClick={() =>
                        setMapRefs((prev) =>
                          prev.length <= 1 ? [""] : prev.filter((_, j) => j !== i)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generatingPlate || saving}
              onClick={() => void handleGenerateMapPlate()}
              className="rounded-lg bg-[#CFFF81] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {generatingPlate ? "Generating…" : "Generate draft"}
            </button>
            <button
              type="button"
              disabled={pinningPlate || saving || (!mapDraftUrl && !mapImageUrl.trim())}
              onClick={() => void handlePinMapPlate()}
              className="rounded-lg border border-[#CFFF81]/40 px-3 py-2 text-sm text-[#CFFF81] disabled:opacity-50"
            >
              {pinningPlate ? "Pinning…" : "Pin for season"}
            </button>
            <button
              type="button"
              disabled={generatingMotion || saving || !mapImageUrl.trim()}
              onClick={() => void handleGenerateMotion()}
              className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 disabled:opacity-50"
            >
              {generatingMotion ? "Motion…" : "Generate ambient loop (M3)"}
            </button>
          </div>

          {mapPinnedAt ? (
            <p className="text-[11px] text-gray-500">
              Pinned {new Date(mapPinnedAt).toLocaleString()}
              {mapSeasonLabel ? ` · ${mapSeasonLabel}` : ""}
              {mapTwinMode ? " · digital twin" : ""}
              {mapLayoutGuided ? " · layout-guided" : ""}
              {mapAmbientVideoUrl ? " · ambient loop on" : ""}
            </p>
          ) : (
            <p className="text-[11px] text-amber-200/80">No season plate pinned yet.</p>
          )}

          {(mapDraftUrl || mapImageUrl.trim()) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {mapDraftUrl ? (
                <div>
                  <p className="mb-1 text-[11px] text-gray-500">Draft</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapDraftUrl}
                    alt="Draft season map plate"
                    className="max-h-48 w-full rounded-lg border border-white/10 object-cover"
                  />
                </div>
              ) : null}
              {mapImageUrl.trim() ? (
                <div>
                  <p className="mb-1 text-[11px] text-gray-500">Live / pinned</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapImageUrl.trim()}
                    alt="Live map plate"
                    className="max-h-48 w-full rounded-lg border border-white/10 object-cover"
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-2 border-t border-white/10 pt-3">
            <h4 className="text-xs font-medium text-gray-300">Matchday variants (M4)</h4>
            <p className="text-[11px] text-gray-500">
              Same layout as the pinned plate — lighting/mood only. Hit regions stay aligned.
            </p>
            <label className="block text-xs text-gray-400">
              Active on /g
              <select
                className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                value={mapActiveVariant}
                onChange={(e) =>
                  void handleSetActiveVariant(e.target.value as MapPlateVariantKey | "default")
                }
                disabled={saving}
              >
                <option value="default">Default season plate</option>
                {mapVariants.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <ul className="space-y-2">
              {MAP_PLATE_VARIANT_KEYS.filter((k) => k !== "default").map((key) => {
                const existing = mapVariants.find((v) => v.key === key);
                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">{MAP_PLATE_VARIANT_LABELS[key]}</p>
                      <p className="text-[11px] text-gray-500">
                        {existing
                          ? `Generated ${new Date(existing.generatedAt).toLocaleString()}`
                          : "Not generated"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {existing?.stillUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={existing.stillUrl}
                          alt=""
                          className="h-10 w-16 rounded object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          Boolean(generatingVariantKey) || saving || !mapImageUrl.trim()
                        }
                        onClick={() => void handleGenerateVariant(key)}
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 disabled:opacity-50"
                      >
                        {generatingVariantKey === key
                          ? "…"
                          : existing
                            ? "Regen"
                            : "Generate"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <label className="block text-xs text-gray-400">
          Map image URL (live plate — set by pin, or paste manually)
          <input
            className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
            value={mapImageUrl}
            onChange={(e) => setMapImageUrl(e.target.value)}
            placeholder="/fans/ballard-fc/interbay-stadium-map.jpg"
          />
        </label>

        {mapImageUrl.trim() && zones.length > 0 ? (
          <ZoneMapEditor
            mapImageUrl={mapImageUrl.trim()}
            zones={zones.map((z) => ({
              key: z.key,
              label: z.label,
              x: z.x,
              y: z.y,
              hit: z.hit,
            }))}
            accentColor={garden?.brandKit?.accentColor || "#CFFF81"}
            selectedKey={selectedZoneKey}
            onSelect={setSelectedZoneKey}
            onMove={(key, x, y) => {
              setZones((prev) => prev.map((row) => (row.key === key ? { ...row, x, y } : row)));
              setSelectedZoneKey(key);
            }}
            onHitChange={(key, hit) => {
              setZones((prev) => prev.map((row) => (row.key === key ? { ...row, hit } : row)));
              setSelectedZoneKey(key);
            }}
          />
        ) : null}

        {zones.length === 0 ? (
          <p className="text-sm text-gray-500">No zones yet. Add North End / South End to start.</p>
        ) : (
          <ul className="space-y-3">
            {zones.map((z) => (
              <li
                key={z.key}
                className={`rounded-lg border p-3 ${
                  selectedZoneKey === z.key ? "border-[#CFFF81]/50" : "border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setSelectedZoneKey(z.key)}
                  >
                    <p className="text-sm font-medium text-white">{z.label}</p>
                    <p className="text-[11px] text-gray-500">
                      id: {z.key} · x {z.x.toFixed(2)} · y {z.y.toFixed(2)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeZone(z.key)}
                    className="text-xs text-red-300 underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-400">
                    Zone logo (optional — shows on the public map marker; falls back to sponsor logo)
                  </p>
                  <FileDropZone
                    variant="inline"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                    disabled={uploadingLogoKey === `zone:${z.key}` || saving}
                    label={
                      uploadingLogoKey === `zone:${z.key}`
                        ? "Uploading…"
                        : z.logoUrl.trim()
                          ? "Drop a new logo, or click to replace"
                          : "Drop logo here, or click to browse"
                    }
                    hint="PNG / JPEG / WebP / SVG · under 8MB"
                    onFiles={(files) => void handleUploadLogoFiles("zone", z.key, files)}
                  />
                  <label className="block text-xs text-gray-500">
                    Or paste URL
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                      value={z.logoUrl}
                      onChange={(e) =>
                        setZones((prev) =>
                          prev.map((row) =>
                            row.key === z.key ? { ...row, logoUrl: e.target.value } : row
                          )
                        )
                      }
                      placeholder="/fans/…/pagliacci-logo.png"
                    />
                  </label>
                  {z.logoUrl.trim() ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={z.logoUrl.trim()}
                        alt=""
                        className="h-12 w-12 rounded-lg border border-white/10 bg-white/5 object-contain p-1"
                      />
                      <button
                        type="button"
                        className="text-xs text-red-300 underline"
                        onClick={() =>
                          setZones((prev) =>
                            prev.map((row) => (row.key === z.key ? { ...row, logoUrl: "" } : row))
                          )
                        }
                      >
                        Clear logo
                      </button>
                    </div>
                  ) : null}
                </div>
                <label className="mt-2 block text-xs text-gray-400">
                  Fan prompt
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                    value={z.prompt}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((row) =>
                          row.key === z.key ? { ...row, prompt: e.target.value } : row
                        )
                      )
                    }
                    placeholder="What's your chant idea for the next game?"
                  />
                </label>
                <label className="mt-2 block text-xs text-gray-400">
                  CTA label (on the map marker + button after tap)
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                    value={z.ctaLabel}
                    onChange={(e) =>
                      setZones((prev) =>
                        prev.map((row) =>
                          row.key === z.key ? { ...row, ctaLabel: e.target.value } : row
                        )
                      )
                    }
                    placeholder="Share your chant"
                  />
                </label>
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-xs text-gray-400">
                    X (0–1)
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                      value={Number(z.x.toFixed(3))}
                      onChange={(e) => {
                        const x = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                        setZones((prev) =>
                          prev.map((row) => (row.key === z.key ? { ...row, x } : row))
                        );
                        setSelectedZoneKey(z.key);
                      }}
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    Y (0–1)
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                      value={Number(z.y.toFixed(3))}
                      onChange={(e) => {
                        const y = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                        setZones((prev) =>
                          prev.map((row) => (row.key === z.key ? { ...row, y } : row))
                        );
                        setSelectedZoneKey(z.key);
                      }}
                    />
                  </label>
                </div>
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

        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sponsors (optional)</p>
          {sponsors.length ? (
            <ul className="space-y-3 text-sm">
              {sponsors.map((s) => (
                <li key={s.key} className="rounded-lg border border-white/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{s.name}</span>
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
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Sponsor logo</p>
                    <FileDropZone
                      variant="inline"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                      disabled={uploadingLogoKey === `sponsor:${s.key}` || saving}
                      label={
                        uploadingLogoKey === `sponsor:${s.key}`
                          ? "Uploading…"
                          : s.logoUrl.trim()
                            ? "Drop a new logo, or click to replace"
                            : "Drop logo here, or click to browse"
                      }
                      hint="PNG / JPEG / WebP / SVG · under 8MB"
                      onFiles={(files) => void handleUploadLogoFiles("sponsor", s.key, files)}
                    />
                    <label className="block text-xs text-gray-500">
                      Or paste URL
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                        value={s.logoUrl}
                        onChange={(e) =>
                          setSponsors((prev) =>
                            prev.map((row) =>
                              row.key === s.key ? { ...row, logoUrl: e.target.value } : row
                            )
                          )
                        }
                        placeholder="https://…/logo.png"
                      />
                    </label>
                    {s.logoUrl.trim() ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.logoUrl.trim()}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-white/10 bg-white/5 object-contain p-1"
                        />
                        <button
                          type="button"
                          className="text-xs text-red-300 underline"
                          onClick={() =>
                            setSponsors((prev) =>
                              prev.map((row) => (row.key === s.key ? { ...row, logoUrl: "" } : row))
                            )
                          }
                        >
                          Clear logo
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <label className="block text-xs text-gray-400">
                    Credit line
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
                      value={s.credit}
                      onChange={(e) =>
                        setSponsors((prev) =>
                          prev.map((row) =>
                            row.key === s.key ? { ...row, credit: e.target.value } : row
                          )
                        )
                      }
                      placeholder="Enabled by…"
                    />
                  </label>
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

      <section className="space-y-4 rounded-xl border border-white/10 bg-transparent p-4">
        <GardenCompositionCanvas
          gardenId={gardenId}
          gardenTitle={garden?.title || "Garden"}
          zones={zoneOptions.map((z) => ({
            key: slugifyKey(z.key || z.label),
            label: z.label.trim() || z.key,
          }))}
          publicHref={publicHref}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-transparent p-4">
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
                    played ? "border-[#CFFF81]/30 bg-[#CFFF81]/5" : "border-white/10"
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

      <details className="rounded-xl border border-white/10 bg-transparent p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-300">
          Advanced · Commerce & debugger
        </summary>
        <div className="mt-4 space-y-8">
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-200">Commerce</h2>
            <p className="text-xs text-gray-500">
              Pin editions, preview merch art, and create stub checkout orders.
            </p>

            <form onSubmit={handlePinEdition} className="space-y-3 border-b border-white/10 pb-4">
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 px-3 py-2"
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

            <div className="space-y-3 border-t border-white/10 pt-4">
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
                    <li key={o.id} className="rounded border border-white/10 px-2 py-1.5">
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

          <div className="space-y-4 border-t border-white/10 pt-6">
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
                  <li key={m.id} className="rounded border border-white/10 px-2 py-1.5">
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
