"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Garden } from "@/lib/song-garden-v2/garden/types";

export default function GardensAdminClient() {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedingBallard, setSeedingBallard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gardens", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { gardens?: Garden[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load gardens");
      setGardens(body.gardens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedBallardFc() {
    setSeedingBallard(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/gardens/demos/ballard-fc", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(body.error || "Could not seed Ballard FC demo");
      setNotice(
        body.created
          ? "Ballard FC Song Garden ready — open the public link to test."
          : "Ballard FC Song Garden updated with stadium map + zones."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeedingBallard(false);
    }
  }

  const ballard = gardens.find((g) => g.slug === "ballard-fc");

  return (
    <div className="w-full space-y-8 text-gray-100">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
            Persistent Worlds
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Song Gardens</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Create a Song Garden first. Then add blooms (shows / journeys) inside it.
          </p>
        </div>
        <Link
          href="/admin/gardens/new"
          className="rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black"
        >
          + Create Song Garden
        </Link>
      </div>

      <section className="space-y-3 rounded-xl border border-[#CFFF81]/25 bg-transparent p-4">
        <h2 className="text-sm font-medium text-white">Ballard FC demo</h2>
        <p className="text-xs text-gray-400">
          Loads Interbay Stadium map with sponsored zones (Supporters, Beer Garden, Tequila Zone,
          Pagliacci Pitch, …).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={seedingBallard}
            onClick={() => void seedBallardFc()}
            className="rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {seedingBallard
              ? "Setting up…"
              : ballard
                ? "Refresh Ballard FC demo"
                : "Create Ballard FC demo"}
          </button>
          {ballard ? (
            <Link
              href="/g/ballard-fc"
              className="rounded-lg border border-[#CFFF81]/40 px-4 py-2.5 text-sm font-medium text-[#CFFF81]"
            >
              Open public garden
            </Link>
          ) : null}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-[#CFFF81]/10 px-3 py-2 text-sm text-[#CFFF81]">{notice}</p>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : gardens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-5 py-8 text-sm text-gray-400">
          No Song Gardens yet.{" "}
          <Link href="/admin/gardens/new" className="text-[#CFFF81] hover:underline">
            Create one
          </Link>{" "}
          to start, then add blooms inside it.
        </div>
      ) : (
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {gardens.map((g) => (
            <li
              key={g.id}
              className="flex cursor-default flex-col gap-3 bg-transparent px-4 py-4 transition-[outline-color] hover:outline hover:outline-1 hover:outline-[#CFFF81] hover:-outline-offset-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/gardens/${g.id}`}
                  className="font-medium text-white hover:text-[#CFFF81]"
                >
                  {g.title}
                </Link>
                <p className="text-xs text-gray-500">
                  /g/{g.slug} · {g.status} · v{g.worldVersion} · energy{" "}
                  {(g.worldState?.energy ?? 0).toFixed(2)}
                  {g.status === "live" ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/g/${g.slug}`} className="text-[#CFFF81] underline">
                        public
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/gardens/${g.id}/blooms/new`}
                  className="rounded-lg border border-[#CFFF81]/40 bg-transparent px-3 py-1.5 text-xs font-medium text-[#CFFF81] transition-colors hover:bg-[#CFFF81]/10"
                >
                  + Bloom
                </Link>
                <Link
                  href={`/admin/gardens/${g.id}`}
                  className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-[#CFFF81] hover:text-white"
                >
                  Manage
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
