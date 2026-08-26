"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CommunitySettings,
  CreditPack,
  IdentityMode,
  ParticipationIndex,
} from "@/lib/platform-v2/types";

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

/**
 * Live-garden edit chrome: ⋮ menu for community settings / impact / credits.
 * Zone pin-on-map lands next; blank gardens keep default center pulse.
 */
export default function GardenEditChrome({
  gardenId,
  gardenSlug,
  accentColor,
  onExit,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<"settings" | "impact" | "credits" | null>(null);
  const [identityMode, setIdentityMode] = useState<IdentityMode>("open");
  const [reachableAudience, setReachableAudience] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [index, setIndex] = useState<ParticipationIndex | null>(null);
  const [pack, setPack] = useState<CreditPack | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/gardens/${gardenId}/community`, { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { settings: CommunitySettings };
    setIdentityMode(body.settings.identityMode);
    setReachableAudience(
      body.settings.reachableAudience != null ? String(body.settings.reachableAudience) : ""
    );
    setCampaignLabel(body.settings.campaignLabel ?? "");
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
            </p>
            <button
              type="button"
              className="text-sm text-white/50"
              onClick={() => setSheet(null)}
            >
              Close
            </button>
          </div>

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
                Tip: blank gardens use a center “Leave a mark.” Pin places on the map later from
                Advanced admin — live map pins come next.
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
                  {index.contributionsInWindow} marks + {index.reactsInWindow} hearts
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
                <p className="text-sm text-white/50">No credits yet — feature marks after people join.</p>
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
