"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getAllEvents, getEventById, getEventBySlug } from "@/data/eventsClient";
import type { Event } from "@/data/mockEvents";
import SonggardenCanvas from "@/components/songgarden/SonggardenCanvas";
import ComposerLibraryPicker, {
  type LibraryGardenNode,
  type LibraryTarget,
} from "@/components/songgarden/ComposerLibraryPicker";

type GardenRow = { id: string; slug: string; title: string };

type ChapterRow = {
  id: string;
  eventId?: string;
  event_id?: string;
  label?: string;
  title?: string;
  index?: number;
};

function ComposerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gardenParam = searchParams.get("garden");
  const bloomParam = searchParams.get("bloom");

  const [gardens, setGardens] = useState<LibraryGardenNode[]>([]);
  const [looseBlooms, setLooseBlooms] = useState<
    Array<{ id: string; slug: string; title: string }>
  >([]);
  const [treeLoading, setTreeLoading] = useState(true);

  const [resolvedBloom, setResolvedBloom] = useState<Event | null>(null);
  const [bloomLoading, setBloomLoading] = useState(Boolean(bloomParam));
  const [bloomError, setBloomError] = useState<string | null>(null);

  const [resolvedGarden, setResolvedGarden] = useState<GardenRow | null>(null);
  const [gardenLoading, setGardenLoading] = useState(Boolean(gardenParam) && !bloomParam);
  const [gardenError, setGardenError] = useState<string | null>(null);

  // Library tree: gardens → blooms, plus unattached blooms
  useEffect(() => {
    let cancelled = false;
    setTreeLoading(true);
    (async () => {
      try {
        const [eventList, gardensRes] = await Promise.all([
          getAllEvents(),
          fetch("/api/gardens", { cache: "no-store" }),
        ]);
        const gardensBody = (await gardensRes.json().catch(() => ({}))) as {
          gardens?: GardenRow[];
          error?: string;
        };
        if (!gardensRes.ok) throw new Error(gardensBody.error || "Could not load gardens.");

        const events = Array.isArray(eventList) ? eventList : [];
        const eventById = new Map(events.map((e) => [e.id, e]));
        const gardenRows = gardensBody.gardens ?? [];

        const detailed = await Promise.all(
          gardenRows.map(async (garden) => {
            try {
              const res = await fetch(`/api/gardens/${encodeURIComponent(garden.id)}`, {
                cache: "no-store",
              });
              if (!res.ok) {
                return { ...garden, blooms: [] as LibraryGardenNode["blooms"] };
              }
              const data = (await res.json()) as { chapters?: ChapterRow[] };
              const blooms = (data.chapters ?? [])
                .map((ch, index) => {
                  const eventId = String(ch.eventId ?? ch.event_id ?? "");
                  const event = eventById.get(eventId);
                  return {
                    id: eventId || ch.id,
                    slug: event?.slug || eventId || ch.id,
                    title:
                      event?.title ||
                      String(ch.label ?? ch.title ?? `Bloom ${index + 1}`),
                  };
                })
                .filter((b) => b.id);
              return { ...garden, blooms };
            } catch {
              return { ...garden, blooms: [] as LibraryGardenNode["blooms"] };
            }
          })
        );

        const attachedIds = new Set(
          detailed.flatMap((g) => g.blooms.map((b) => b.id))
        );
        const loose = events
          .filter((e) => !attachedIds.has(e.id))
          .map((e) => ({
            id: e.id,
            slug: e.slug || e.id,
            title: e.title || "Untitled bloom",
          }));

        if (!cancelled) {
          setGardens(detailed);
          setLooseBlooms(loose);
        }
      } catch {
        if (!cancelled) {
          setGardens([]);
          setLooseBlooms([]);
        }
      } finally {
        if (!cancelled) setTreeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve bloom deep link
  useEffect(() => {
    if (!bloomParam) {
      setResolvedBloom(null);
      setBloomError(null);
      setBloomLoading(false);
      return;
    }
    let cancelled = false;
    setBloomLoading(true);
    setBloomError(null);
    (async () => {
      try {
        let next = await getEventBySlug(bloomParam);
        if (!next) next = await getEventById(bloomParam);
        if (!cancelled) {
          setResolvedBloom(next);
          if (!next) setBloomError("Bloom not found.");
        }
      } catch (err) {
        if (!cancelled) {
          setResolvedBloom(null);
          setBloomError(err instanceof Error ? err.message : "Could not load bloom.");
        }
      } finally {
        if (!cancelled) setBloomLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bloomParam]);

  // Resolve garden deep link (only when not on a bloom)
  useEffect(() => {
    if (bloomParam || !gardenParam) {
      setResolvedGarden(null);
      setGardenError(null);
      setGardenLoading(false);
      return;
    }
    let cancelled = false;
    setGardenLoading(true);
    setGardenError(null);
    (async () => {
      try {
        const res = await fetch(`/api/gardens/${encodeURIComponent(gardenParam)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          garden?: GardenRow & { title?: string };
          error?: string;
        };
        if (!res.ok || !data.garden) {
          throw new Error(data.error || "Garden not found.");
        }
        if (!cancelled) {
          setResolvedGarden({
            id: data.garden.id,
            slug: data.garden.slug,
            title: data.garden.title ?? data.garden.slug,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setResolvedGarden(null);
          setGardenError(err instanceof Error ? err.message : "Could not load garden.");
        }
      } finally {
        if (!cancelled) setGardenLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gardenParam, bloomParam]);

  const bloomGardenMeta = useMemo(() => {
    if (!resolvedBloom) return null;
    for (const garden of gardens) {
      const match = garden.blooms.find(
        (b) => b.id === resolvedBloom.id || b.slug === resolvedBloom.slug
      );
      if (match) return { gardenId: garden.id, gardenTitle: garden.title };
    }
    return null;
  }, [gardens, resolvedBloom]);

  const current: LibraryTarget = useMemo(() => {
    if (resolvedBloom) {
      return {
        type: "bloom",
        id: resolvedBloom.id,
        slug: resolvedBloom.slug || resolvedBloom.id,
        title: resolvedBloom.title || "Bloom",
        gardenId: bloomGardenMeta?.gardenId,
        gardenTitle: bloomGardenMeta?.gardenTitle,
      };
    }
    if (resolvedGarden) {
      return {
        type: "garden",
        id: resolvedGarden.id,
        slug: resolvedGarden.slug,
        title: resolvedGarden.title,
      };
    }
    return { type: "master" };
  }, [resolvedBloom, resolvedGarden, bloomGardenMeta]);

  function navigateLibrary(target: LibraryTarget) {
    if (target.type === "master") {
      router.replace("/admin/composer");
      return;
    }
    if (target.type === "garden") {
      router.replace(
        `/admin/composer?garden=${encodeURIComponent(target.slug || target.id)}`
      );
      return;
    }
    router.replace(`/admin/composer?bloom=${encodeURIComponent(target.slug || target.id)}`);
  }

  const resolving = Boolean(bloomParam) ? bloomLoading : Boolean(gardenParam) ? gardenLoading : false;
  const resolveError = bloomParam ? bloomError : gardenParam ? gardenError : null;

  const canvasKey = bloomParam
    ? `bloom:${resolvedBloom?.id ?? bloomParam}`
    : gardenParam
      ? `garden:${resolvedGarden?.id ?? gardenParam}`
      : "master";

  const picker = (
    <ComposerLibraryPicker
      current={current}
      gardens={gardens}
      looseBlooms={looseBlooms}
      onSelect={navigateLibrary}
      loading={treeLoading}
    />
  );

  return (
    <div className="w-full space-y-6 text-white">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Musical Formation
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Composer</h1>
      </div>

      {resolving ? <p className="text-sm text-gray-500">Loading library…</p> : null}

      {resolveError ? (
        <div className="space-y-3">
          <p className="text-sm text-rose-300">{resolveError}</p>
          <button
            type="button"
            onClick={() => navigateLibrary({ type: "master" })}
            className="text-sm text-[#CFFF81] hover:underline"
          >
            ← Back to Master
          </button>
        </div>
      ) : null}

      {!resolving && !resolveError ? (
        bloomParam && resolvedBloom ? (
          <SonggardenCanvas
            key={canvasKey}
            eventId={resolvedBloom.id}
            eventTitle={resolvedBloom.title}
            eventSlug={resolvedBloom.slug}
            initialScope="bloom"
            libraryPicker={picker}
          />
        ) : gardenParam && resolvedGarden ? (
          <SonggardenCanvas
            key={canvasKey}
            gardenId={resolvedGarden.id}
            eventTitle={resolvedGarden.title}
            initialScope="garden"
            libraryPicker={picker}
          />
        ) : !bloomParam && !gardenParam ? (
          <SonggardenCanvas
            key={canvasKey}
            initialScope="master"
            libraryPicker={picker}
          />
        ) : null
      ) : null}
    </div>
  );
}

export default function ComposerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading Composer…</p>}>
      <ComposerPageInner />
    </Suspense>
  );
}
