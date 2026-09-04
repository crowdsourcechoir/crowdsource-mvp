"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GardenCompositionCanvas from "@/components/song-garden-v2/GardenCompositionCanvas";
import type { Garden } from "@/lib/song-garden-v2/garden/types";

export default function GardenCanvasPage() {
  const params = useParams();
  const gardenId = typeof params?.id === "string" ? params.id : "";
  const [garden, setGarden] = useState<Garden | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gardenId) return;
    let cancelled = false;
    fetch(`/api/gardens/${gardenId}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { garden?: Garden; error?: string };
        if (!res.ok) throw new Error(body.error || "Garden not found");
        if (!cancelled) {
          setGarden(body.garden ?? null);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGarden(null);
          setError(err instanceof Error ? err.message : "Garden not found");
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gardenId]);

  const zones = useMemo(
    () =>
      (garden?.brandKit?.zones ?? [])
        .filter((z) => z.key?.trim() && z.label?.trim())
        .map((z) => ({ key: z.key, label: z.label })),
    [garden]
  );

  if (!loaded) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!garden) {
    return (
      <div>
        <p className="text-gray-400">{error || "Garden not found."}</p>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          This composition canvas needs a valid Garden. Pick one from Composer.
        </p>
        <Link href="/admin/composer" className="mt-3 inline-block text-sm font-medium text-[#CFFF81] hover:underline">
          Open Composer
        </Link>
      </div>
    );
  }

  const publicHref = garden.slug ? `/g/${garden.slug}` : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/composer" className="text-gray-400 hover:text-white">
          ← Composer
        </Link>
        <span className="text-gray-600">·</span>
        <Link href={`/admin/gardens/${garden.id}`} className="text-gray-400 hover:text-white">
          {garden.title}
        </Link>
        {publicHref ? (
          <>
            <span className="text-gray-600">·</span>
            <Link href={publicHref} target="_blank" rel="noopener noreferrer" className="text-[#CFFF81] hover:underline">
              Public garden
            </Link>
          </>
        ) : null}
      </div>
      <GardenCompositionCanvas
        gardenId={garden.id}
        gardenTitle={garden.title}
        zones={zones}
        publicHref={publicHref}
      />
    </div>
  );
}
