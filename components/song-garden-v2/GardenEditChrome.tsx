"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CommunitySettings,
  CreditPack,
  IdentityMode,
  ParticipationIndex,
} from "@/lib/platform-v2/types";
import {
  ATMOSPHERE_MODE_LABELS,
  type AtmosphereMode,
  type GardenAtmosphere,
} from "@/lib/song-garden-v2/garden/types";

type Props = {
  gardenId: string;
  gardenSlug: string;
  accentColor: string;
  onExit: () => void;
};

function pct(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(rate < 0.01 ? 2 : 1)}%`;
}

type Sheet = "settings" | "impact" | "credits" | "atmosphere" | null;

/**
 * Live-garden edit chrome: ⋮ for community + atmosphere.
 * Zone pin-on-map lands next; blank gardens keep center Plant a seed.
 */
export default function GardenEditChrome({
  gardenId,
  gardenSlug,
  accentColor,
  onExit,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [identityMode, setIdentityMode] = useState<IdentityMode>("open");
  const [reachableAudience, setReachableAudience] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [index, setIndex] = useState<ParticipationIndex | null>(null);
  const [pack, setPack] = useState<CreditPack | null>(null);
  const [atmosphere, setAtmosphere] = useState<GardenAtmosphere | null>(null);
  const [atmMode, setAtmMode] = useState<AtmosphereMode>("brand_wash");
  const [stillUrl, setStillUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [vibePrompt, setVibePrompt] = useState("");

  const loadSettings = useCallback(async () => {
    const [cRes, aRes] = await Promise.all([
      fetch(`/api/gardens/${gardenId}/community`, { cache: "no-store" }),
      fetch(`/api/gardens/${gardenId}/atmosphere`, { cache: "no-store" }),
    ]);
    if (cRes.ok) {
      const body = (await cRes.json()) as { settings: CommunitySettings };
      setIdentityMode(body.settings.identityMode);
      setReachableAudience(
        body.settings.reachableAudience != null ? String(body.settings.reachableAudience) : ""
      );
      setCampaignLabel(body.settings.campaignLabel ?? "");
    }
    if (aRes.ok) {
      const body = (await aRes.json()) as { atmosphere: GardenAtmosphere };
      setAtmosphere(body.atmosphere);
      setAtmMode(body.atmosphere.mode);
      setStillUrl(body.atmosphere.stillUrl ?? "");
      setVideoUrl(body.atmosphere.videoUrl ?? "");
      setVibePrompt(body.atmosphere.vibePrompt ?? "");
    }
  }, [gardenId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    setBusy(true);
    setNotice(null);
    try {
      const audience = reachableAudience.trim() ? Number(reachableAudience) : null;
      const res = await fetch(`/api/gardens/${gardenId}/community`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityMode,
          reachableAudience: audience && Number.isFinite(audience) ? audience : null,
          campaignLabel: campaignLabel.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed");
      setNotice("Saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAtmosphere() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/atmosphere`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: atmMode,
          stillUrl: stillUrl.trim() || null,
          videoUrl: videoUrl.trim() || null,
          posterUrl: stillUrl.trim() || null,
          vibePrompt: vibePrompt.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save atmosphere");
      setAtmosphere(body.atmosphere as GardenAtmosphere);
      setNotice(
        atmMode === "gaussian"
          ? "Gaussian saved as mode — soft aurora for now; full env coming soon."
          : "Atmosphere saved — refresh if the background doesn’t update."
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save atmosphere");
    } finally {
      setBusy(false);
    }
  }

  async function generateVibe() {
    setBusy(true);
    setNotice(null);
    try {
      // Persist prompt + mode first so generate reads it.
      await fetch(`/api/gardens/${gardenId}/atmosphere`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "vibe_video",
          stillUrl: stillUrl.trim() || null,
          videoUrl: videoUrl.trim() || null,
          posterUrl: stillUrl.trim() || null,
          vibePrompt: vibePrompt.trim(),
        }),
      });
      const res = await fetch(`/api/gardens/${gardenId}/atmosphere/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibePrompt: vibePrompt.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Generate failed");
      const atm = body.atmosphere as GardenAtmosphere;
      setAtmosphere(atm);
      setAtmMode("vibe_video");
      setStillUrl(atm.stillUrl ?? "");
      setVideoUrl(atm.videoUrl ?? "");
      setVibePrompt(atm.vibePrompt ?? vibePrompt);
      setNotice("Vibe loop ready — reload the garden to see it full-bleed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadImpact() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/index`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load impact");
      setIndex(body.index as ParticipationIndex);
      setSheet("impact");
      setMenuOpen(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load impact");
    } finally {
      setBusy(false);
    }
  }

  async function loadCredits() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/credit-pack`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load credits");
      setPack(body.pack as CreditPack);
      setSheet("credits");
      setMenuOpen(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load credits");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredits() {
    if (!pack) return;
    const text = [
      pack.campaignLabel || pack.gardenTitle,
      "People who helped make this:",
      ...pack.entries.map((e) => `• ${e.creditName}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Credits copied.");
    } catch {
      setNotice("Copy failed — select the list manually.");
    }
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div
          className="pointer-events-auto rounded-full border border-white/20 bg-black/55 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md"
          style={{ borderColor: `${accentColor}66` }}
        >
          Editing
        </div>
        <div className="pointer-events-auto relative">
          <button
            type="button"
            aria-label="Garden settings"
            onClick={() => {
              setMenuOpen((v) => !v);
              setSheet(null);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-lg text-white backdrop-blur-md"
          >
            ⋮
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-xl backdrop-blur-md">
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  setSheet("atmosphere");
                  setMenuOpen(false);
                }}
              >
                Atmosphere
              </button>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                onClick={() => {
                  setSheet("settings");
                  setMenuOpen(false);
                }}
              >
                Who can join & show size
              </button>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                disabled={busy}
                onClick={() => void loadImpact()}
              >
                Show impact
              </button>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10"
                disabled={busy}
                onClick={() => void loadCredits()}
              >
                Share credits
              </button>
              <Link
                href={`/admin/gardens/${gardenId}`}
                className="block w-full border-t border-white/10 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
              >
                Advanced admin
              </Link>
              <button
                type="button"
                className="block w-full border-t border-white/10 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/10"
                onClick={onExit}
              >
                Exit edit
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {sheet ? (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-auto rounded-t-3xl border border-white/15 bg-black/92 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-white/60">
              {sheet === "settings" && "Settings"}
              {sheet === "impact" && "Impact"}
              {sheet === "credits" && "Credits"}
              {sheet === "atmosphere" && "Atmosphere"}
            </p>
            <button type="button" className="text-sm text-white/50" onClick={() => setSheet(null)}>
              Close
            </button>
          </div>

          {sheet === "atmosphere" ? (
            <div className="space-y-3">
              <p className="text-xs text-white/55">
                What sits behind the prompts — same idea as Bloom vibe loops, but you can pick photo,
                map plate, brand wash, or (soon) a gaussian environment.
              </p>
              <label className="block text-xs text-white/60">
                Background
                <select
                  value={atmMode}
                  onChange={(e) => setAtmMode(e.target.value as AtmosphereMode)}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  {(Object.keys(ATMOSPHERE_MODE_LABELS) as AtmosphereMode[]).map((key) => (
                    <option key={key} value={key}>
                      {ATMOSPHERE_MODE_LABELS[key]}
                      {key === "gaussian" ? " (coming soon)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {atmMode === "static_photo" || atmMode === "vibe_video" || atmMode === "map_plate" ? (
                <label className="block text-xs text-white/60">
                  Photo / poster URL
                  <input
                    type="url"
                    value={stillUrl}
                    onChange={(e) => setStillUrl(e.target.value)}
                    placeholder="https://… or /path/to/image.jpg"
                    className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                  />
                </label>
              ) : null}

              {atmMode === "vibe_video" ? (
                <>
                  <label className="block text-xs text-white/60">
                    Video loop URL
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://…/loop.mp4"
                      className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                    />
                  </label>
                  <label className="block text-xs text-white/60">
                    Vibe prompt
                    <textarea
                      value={vibePrompt}
                      onChange={(e) => setVibePrompt(e.target.value)}
                      rows={2}
                      placeholder="Night mist, chartreuse accents…"
                      className="mt-1 w-full resize-none rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !vibePrompt.trim()}
                    onClick={() => void generateVibe()}
                    className="w-full rounded-xl border border-white/25 px-4 py-2.5 text-sm text-white disabled:opacity-40"
                  >
                    {busy ? "Generating…" : "Generate vibe loop"}
                  </button>
                  <p className="text-[11px] text-white/40">
                    Creates a still + looping video from the vibe prompt (same engine as Bloom
                    storyboards). Takes a minute.
                  </p>
                </>
              ) : null}

              {atmMode === "map_plate" ? (
                <p className="text-[11px] text-white/45">
                  Uses the pinned season map (and ambient loop if you have one). Leave URLs blank to pull
                  from the map automatically.
                </p>
              ) : null}

              {atmMode === "gaussian" ? (
                <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-50">
                  Gaussian environments aren’t generated here yet. Saving this mode uses a soft aurora
                  field so the stage stays alive until the full env ships.
                </p>
              ) : null}

              {atmMode === "brand_wash" ? (
                <p className="text-[11px] text-white/45">
                  Brand colors only — clean center stage for Plant a seed, no photo or video.
                </p>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAtmosphere()}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: accentColor }}
              >
                Save atmosphere
              </button>
              {atmosphere ? (
                <p className="text-center font-mono text-[10px] text-white/35">
                  Now: {ATMOSPHERE_MODE_LABELS[atmosphere.mode]}
                </p>
              ) : null}
            </div>
          ) : null}

          {sheet === "settings" ? (
            <div className="space-y-3">
              <label className="block text-xs text-white/60">
                Who can join
                <select
                  value={identityMode}
                  onChange={(e) => setIdentityMode(e.target.value as IdentityMode)}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  <option value="open">Anyone (name optional)</option>
                  <option value="account_required">Must share name + email first</option>
                </select>
              </label>
              <label className="block text-xs text-white/60">
                About how many people could join?
                <input
                  type="number"
                  min={1}
                  value={reachableAudience}
                  onChange={(e) => setReachableAudience(e.target.value)}
                  placeholder="Optional — e.g. 400"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
                <span className="mt-1 block text-[11px] text-white/40">
                  Only for a participation %. Leave blank to track counts only.
                </span>
              </label>
              <label className="block text-xs text-white/60">
                Campaign / show name
                <input
                  type="text"
                  value={campaignLabel}
                  onChange={(e) => setCampaignLabel(e.target.value)}
                  placeholder="e.g. Populus Thresholds"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveSettings()}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: accentColor }}
              >
                Save
              </button>
              <p className="text-[11px] text-white/40">
                Tip: blank gardens use center <strong className="font-semibold text-white/60">Plant a
                seed</strong>. On a map, tap empty ground to pin a place. Hover the eyebrow / line
                under it to rename the world.
              </p>
            </div>
          ) : null}

          {sheet === "impact" && index ? (
            <div className="grid gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/45">Who showed up</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {index.participationRate != null
                    ? pct(index.participationRate)
                    : index.contributors}
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {index.participationRate != null
                    ? `${index.contributors} of ~${index.reachableAudience}`
                    : "people (set show size for a %)"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/45">Activity</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {index.sponsoredParticipationVolume}
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {index.contributionsInWindow} seeds + {index.reactsInWindow} hearts
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/45">Heard it live</p>
                <p className="mt-1 text-xl font-semibold text-white">{index.activationReach}</p>
              </div>
            </div>
          ) : null}

          {sheet === "credits" && pack ? (
            <div className="space-y-3">
              {pack.entries.length === 0 ? (
                <p className="text-sm text-white/50">
                  No credits yet — feature seeds after people plant them.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-white/85">
                  {pack.entries.map((e) => (
                    <li key={`${e.sourceType}-${e.sourceId}`}>
                      {e.creditName}
                      {e.selected ? " · featured" : ""}
                      {e.performed ? " · performed" : ""}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => void copyCredits()}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black"
                style={{ background: accentColor }}
              >
                Copy for sharing
              </button>
            </div>
          ) : null}

          {notice ? <p className="mt-3 text-center text-xs text-amber-100">{notice}</p> : null}
          <p className="mt-3 text-center font-mono text-[10px] text-white/30">/{gardenSlug}</p>
        </div>
      ) : null}
    </>
  );
}
