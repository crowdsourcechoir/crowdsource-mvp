"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GardenKind, GardenStatus } from "@/lib/song-garden-v2/garden/types";

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function NewGardenPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<GardenKind>("series");
  const [status, setStatus] = useState<GardenStatus>("draft");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewSlug = useMemo(() => (slugTouched ? slug : slugify(title)), [slug, slugTouched, title]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const finalSlug = (slugTouched ? slug : slugify(title)).trim();
      if (!title.trim() || !finalSlug) {
        throw new Error("Title and slug are required.");
      }
      const res = await fetch("/api/gardens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: finalSlug,
          kind,
          status,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        garden?: { id: string };
        error?: string;
      };
      if (!res.ok || !body.garden) {
        throw new Error(body.error || "Could not create Song Garden.");
      }
      router.push(`/admin/gardens/${body.garden.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 text-white">
      <div>
        <Link href="/admin/gardens" className="text-sm text-gray-400 hover:text-white">
          ← Song Gardens
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">
          Create
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">New Song Garden</h1>
        <p className="mt-2 text-sm text-gray-400">
          Start with the world. After this, add blooms (shows / journeys) inside it.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 rounded-xl border border-white/10 p-5">
        <label className="block text-xs text-gray-400">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Ethereum Global Conference"
            required
            autoFocus
          />
        </label>

        <label className="block text-xs text-gray-400">
          Public URL slug
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-gray-500">/g/</span>
            <input
              className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={slugTouched ? slug : previewSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="ethereum-global-conference"
              required
            />
          </div>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-gray-400">
            Kind
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={kind}
              onChange={(e) => setKind(e.target.value as GardenKind)}
            >
              <option value="series">Series</option>
              <option value="season">Season</option>
              <option value="evergreen">Evergreen</option>
            </select>
          </label>
          <label className="block text-xs text-gray-400">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 text-sm text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value as GardenStatus)}
            >
              <option value="draft">Draft (not public yet)</option>
              <option value="live">Live</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-[#CFFF81] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Song Garden"}
          </button>
          <Link
            href="/admin/gardens"
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-gray-300 hover:text-white"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
