"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrCreateSonggardenDeviceId } from "@/data/songgardenClient";
import type { CommunitySettings, ContributionNode, ParticipantIdentity } from "@/lib/platform-v2/types";

type Props = {
  gardenId: string;
  accentColor: string;
};

/**
 * Public Platform V2 surface on /g — claim (if needed), discover selected culture, react, see credit.
 */
export default function GardenCommunityCulturePanel({ gardenId, accentColor }: Props) {
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [identity, setIdentity] = useState<ParticipantIdentity | null>(null);
  const [contributions, setContributions] = useState<ContributionNode[]>([]);
  const [credits, setCredits] = useState<Array<{ creditName: string }>>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deviceId = typeof window !== "undefined" ? getOrCreateSonggardenDeviceId() : "";

  const load = useCallback(async () => {
    if (!gardenId) return;
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/gardens/${gardenId}/community${qs}`, { cache: "no-store" }),
      fetch(`/api/gardens/${gardenId}/community/contributions?selected=1`, { cache: "no-store" }),
    ]);
    if (sRes.ok) {
      const body = (await sRes.json()) as {
        settings: CommunitySettings;
        identity: ParticipantIdentity | null;
      };
      setSettings(body.settings);
      setIdentity(body.identity);
    }
    if (cRes.ok) {
      const body = (await cRes.json()) as {
        contributions: ContributionNode[];
        credits: Array<{ creditName: string }>;
      };
      setContributions(body.contributions ?? []);
      setCredits(body.credits ?? []);
    }
  }, [gardenId, deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const needsClaim =
    settings?.identityMode === "account_required" && !(identity?.claimed);

  async function handleClaim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, displayName, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Claim failed");
      setIdentity(body.identity);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReact(node: ContributionNode) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gardens/${gardenId}/community/contributions/${node.sourceType}/${encodeURIComponent(node.sourceId)}/react`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "React failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "React failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGrowBloom(node: ContributionNode) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/blooms/from-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: node.sourceType,
          sourceId: node.sourceId,
          excerpt: node.excerpt,
          creditName: node.creditName,
          attachChapter: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not grow Bloom");
      await load();
      if (body.bloom?.publicPath) {
        window.open(body.bloom.publicPath, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grow Bloom");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-4 pb-6">
      <div className="rounded-2xl border border-white/15 bg-black/45 p-4 backdrop-blur-md">
        <p
          className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.25em]"
          style={{ color: accentColor }}
        >
          Culture
        </p>
        <p className="mt-2 text-center font-mono text-xs text-white/70">
          Selected contributions from this Garden — react to amplify. Credits stay with the people who helped make it.
        </p>

        {needsClaim ? (
          <div className="mt-4 space-y-2">
            <p className="text-center font-mono text-xs text-amber-100">
              This Garden requires a claimed identity before you react.
            </p>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm text-white"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleClaim()}
              className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: accentColor }}
            >
              Claim identity
            </button>
          </div>
        ) : null}

        {!needsClaim && settings.identityMode === "open" && !identity?.claimed ? (
          <button
            type="button"
            className="mt-3 w-full font-mono text-[11px] text-white/50 underline"
            onClick={() => {
              const name = window.prompt("Display name to claim (optional)");
              const mail = window.prompt("Email to claim (optional)");
              if (name && mail) {
                setDisplayName(name);
                setEmail(mail);
                void (async () => {
                  setDisplayName(name);
                  setEmail(mail);
                  setBusy(true);
                  try {
                    const res = await fetch(`/api/gardens/${gardenId}/community/claim`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ deviceId, displayName: name, email: mail }),
                    });
                    if (res.ok) await load();
                  } finally {
                    setBusy(false);
                  }
                })();
              }
            }}
          >
            Optional: claim your name for credit
          </button>
        ) : null}

        <ul className="mt-4 space-y-2">
          {contributions.length === 0 ? (
            <li className="text-center font-mono text-xs text-white/40">
              No selected culture yet — Composer can select contributions from admin.
            </li>
          ) : (
            contributions.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-white">
                    {n.excerpt || n.kind}
                  </p>
                  <p className="font-mono text-[10px] text-white/45">
                    {n.creditName || "Anonymous"}
                    {n.performed ? " · performed" : ""} · ♥ {n.reactCount}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy || needsClaim}
                    onClick={() => void handleReact(n)}
                    className="rounded-full border px-3 py-1.5 font-mono text-xs disabled:opacity-40"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    ♥ React
                  </button>
                  {n.bloomEventId ? (
                    <a
                      href={`/admin/events/${n.bloomEventId}`}
                      className="rounded-full border border-white/25 px-3 py-1.5 text-center font-mono text-[10px] text-white/70"
                    >
                      Open Bloom
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleGrowBloom(n)}
                      className="rounded-full border border-white/25 px-3 py-1.5 font-mono text-[10px] text-white/80 disabled:opacity-40"
                    >
                      Grow Bloom
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>

        {credits.length > 0 ? (
          <p className="mt-3 text-center font-mono text-[10px] text-white/40">
            In-Garden credit: {credits.map((c) => c.creditName).slice(0, 8).join(" · ")}
            {credits.length > 8 ? "…" : ""}
          </p>
        ) : null}

        {error ? <p className="mt-2 text-center text-xs text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
