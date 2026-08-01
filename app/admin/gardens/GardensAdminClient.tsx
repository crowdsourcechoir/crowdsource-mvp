"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Garden } from "@/lib/song-garden-v2/garden/types";

export default function GardensAdminClient() {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/gardens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title, status: "live", kind: "series" }),
      });
      const body = (await res.json().catch(() => ({}))) as { garden?: Garden; error?: string };
      if (!res.ok) throw new Error(body.error || "Create failed");
      setSlug("");
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-gray-100">
      <div>
        <h1 className="text-xl font-semibold text-white">Song Gardens</h1>
        <p className="mt-1 text-sm text-gray-400">
          Persistent worlds that span multiple show events. Attach events as chapters so
          contributions grow a shared garden.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-gray-800 bg-[#121214] p-4">
        <h2 className="text-sm font-medium text-gray-200">Create garden</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-gray-400">
            Slug
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ethglobal-2026"
              required
            />
          </label>
          <label className="block text-xs text-gray-400">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ETHGlobal Garden 2026"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-[#CFFF81] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : gardens.length === 0 ? (
        <p className="text-sm text-gray-500">No gardens yet.</p>
      ) : (
        <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800">
          {gardens.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/admin/gardens/${g.id}`} className="font-medium text-white hover:underline">
                  {g.title}
                </Link>
                <p className="text-xs text-gray-500">
                  /{g.slug} · {g.status} · v{g.worldVersion} · energy{" "}
                  {(g.worldState?.energy ?? 0).toFixed(2)}
                </p>
              </div>
              <Link
                href={`/admin/gardens/${g.id}`}
                className="text-xs text-gray-400 underline hover:text-white"
              >
                Manage
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
