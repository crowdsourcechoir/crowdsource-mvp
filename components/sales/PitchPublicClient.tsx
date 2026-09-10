"use client";

import { useEffect, useState } from "react";

type PitchPublic = {
  title: string;
  organizationName: string | null;
  googleSlidesUrl: string | null;
  hasPdf: boolean;
  shareUrl: string;
};

export default function PitchPublicClient({ token }: { token: string }) {
  const [pitch, setPitch] = useState<PitchPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/p/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Not found");
        setPitch(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-md text-center">
          <p className="csc-eyebrow">Pitch</p>
          <h1 className="mt-3 text-2xl font-bold">Unavailable</h1>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
        </div>
      </main>
    );
  }

  if (!pitch) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-gray-400">Loading…</main>
    );
  }

  const embedUrl = pitch.googleSlidesUrl
    ? pitch.googleSlidesUrl.replace(/\/edit.*$/, "/embed?start=false&loop=false&delayms=3000")
    : null;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">Crowdsource Choir</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{pitch.title}</h1>
        {pitch.organizationName ? (
          <p className="mt-2 text-sm text-gray-400">Prepared for {pitch.organizationName}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {pitch.googleSlidesUrl ? (
            <a
              href={pitch.googleSlidesUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-[#CFFF81] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#CFFF81] hover:bg-[#CFFF81] hover:text-black"
            >
              Open deck
            </a>
          ) : null}
        </div>

        {embedUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <iframe
              title={pitch.title}
              src={embedUrl}
              className="aspect-video w-full"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="mt-8 text-sm text-gray-500">Deck link not available yet.</p>
        )}
      </div>
    </main>
  );
}
