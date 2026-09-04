"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listSessions } from "@/data/livePromptGame";
import type { PromptGameSession } from "@/data/livePromptGame";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function LivePromptGameSessionsPage() {
  const [sessions, setSessions] = useState<PromptGameSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Sessions — Past Sessions</h1>
        <Link
          href="/admin/live"
          className="text-sm font-medium text-gray-500 hover:text-gray-300"
        >
          ← Back to Live
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-gray-500">No sessions yet. Launch one from the Live page.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/live-prompt-game/sessions/${s.id}`}
                className="block rounded-xl border border-gray-700/60 bg-transparent p-4 transition hover:border-gray-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{s.name}</span>
                  <span className="text-sm text-gray-500">{formatDate(s.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  /live/{s.slug} · {s.state}
                  {s.ended_at ? " · Ended" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
