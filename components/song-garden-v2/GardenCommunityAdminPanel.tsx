"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CommunitySettings,
  ContributionNode,
  CreditPack,
  IdentityMode,
  ParticipationIndex,
} from "@/lib/platform-v2/types";

type Props = {
  gardenId: string;
  /** Public slug for “Edit garden” deep link */
  gardenSlug?: string | null;
};

function pct(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(rate < 0.01 ? 2 : 1)}%`;
}

/**
 * Human Community admin — no JSON dumps. Scoreboard + credits + feature list.
 */
export default function GardenCommunityAdminPanel({ gardenId, gardenSlug }: Props) {
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [identityMode, setIdentityMode] = useState<IdentityMode>("open");
  const [reachableAudience, setReachableAudience] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [populusPilot, setPopulusPilot] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [index, setIndex] = useState<ParticipationIndex | null>(null);
  const [pack, setPack] = useState<CreditPack | null>(null);
  const [credits, setCredits] = useState<
    Array<{ creditName: string; kind: string; selected: boolean; reactCount: number }>
  >([]);
  const [contributions, setContributions] = useState<ContributionNode[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const load = useCallback(async () => {
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/gardens/${gardenId}/community`, { cache: "no-store" }),
      fetch(`/api/gardens/${gardenId}/community/contributions`, { cache: "no-store" }),
    ]);
    if (sRes.ok) {
      const body = (await sRes.json()) as { settings: CommunitySettings };
      setSettings(body.settings);
      setIdentityMode(body.settings.identityMode);
      setReachableAudience(
        body.settings.reachableAudience != null ? String(body.settings.reachableAudience) : ""
      );
      setCampaignLabel(body.settings.campaignLabel ?? "");
      setPopulusPilot(Boolean(body.settings.populusPilot));
    }
    if (cRes.ok) {
      const body = (await cRes.json()) as {
        contributions: ContributionNode[];
        credits: Array<{ creditName: string; kind: string; selected: boolean; reactCount: number }>;
      };
      setContributions(body.contributions ?? []);
      setCredits(body.credits ?? []);
    }
  }, [gardenId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
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
          populusPilot,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: CommunitySettings;
      };
      if (!res.ok) throw new Error(body.error || "Save failed");
      setSettings(body.settings ?? null);
      setNotice("Saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleImpact() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/index`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load impact");
      setIndex(body.index as ParticipationIndex);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load impact");
    } finally {
      setBusy(false);
    }
  }

  async function handleCredits() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/credit-pack`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load credits");
      setPack(body.pack as CreditPack);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load credits");
    } finally {
      setBusy(false);
    }
  }

  async function copyCreditsShare() {
    if (!pack) await handleCredits();
    const current = pack;
    const res = await fetch(`/api/gardens/${gardenId}/community/credit-pack`, {
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) {
      setNotice(body.error || "Could not load credits");
      return;
    }
    const next = body.pack as CreditPack;
    setPack(next);
    const lines = [
      next.campaignLabel || next.gardenTitle,
      "People who helped make this:",
      ...next.entries.map((e) => {
        const tags = [
          e.selected ? "featured" : null,
          e.performed ? "performed" : null,
          e.reactCount > 0 ? `${e.reactCount}♥` : null,
        ]
          .filter(Boolean)
          .join(", ");
        return `• ${e.creditName}${tags ? ` (${tags})` : ""}`;
      }),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Credits copied — paste into a post, email, or deck.");
    } catch {
      setNotice("Could not copy — scroll to Share credits below.");
    }
  }

  async function handleSelect(node: ContributionNode) {
    setBusy(true);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select",
          sourceType: node.sourceType,
          sourceId: node.sourceId,
          selected: !node.selected,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update");
      await load();
      setNotice(node.selected ? "Removed from Culture." : "Featured in Culture.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function handlePerform(node: ContributionNode) {
    setBusy(true);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "perform",
          sourceType: node.sourceType,
          sourceId: node.sourceId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not mark performed");
      await load();
      setNotice("Marked as performed live.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not mark performed");
    } finally {
      setBusy(false);
    }
  }

  const editHref = gardenSlug ? `/g/${gardenSlug}?edit=1` : null;

  return (
    <section className="space-y-4 rounded-xl border border-[#CFFF81]/25 bg-[#121214] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Community</h2>
          <p className="mt-1 text-xs text-gray-400">
            Who can join, what gets featured, who gets credit, and how the show landed — in plain
            language.
          </p>
        </div>
        {editHref ? (
          <Link
            href={editHref}
            className="rounded-lg bg-[#CFFF81] px-3 py-2 text-xs font-semibold text-black"
          >
            Edit garden live
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-gray-800 bg-black/30 p-3 text-xs text-gray-300">
        <p className="font-medium text-white">Quick start</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-gray-400">
          <li>Tap <span className="text-gray-200">Edit garden live</span> to see what fans see.</li>
          <li>Optional: set “about how many people could join” if you want a % for sponsors.</li>
          <li>When people leave marks, feature them here — they show up under Culture.</li>
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-400">
          Who can join
          <select
            value={identityMode}
            onChange={(e) => setIdentityMode(e.target.value as IdentityMode)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          >
            <option value="open">Anyone (name optional)</option>
            <option value="account_required">Must share name + email first</option>
          </select>
        </label>
        <label className="block text-xs text-gray-400">
          About how many people could join?
          <input
            type="number"
            min={1}
            value={reachableAudience}
            onChange={(e) => setReachableAudience(e.target.value)}
            placeholder="Optional — e.g. 400 in the room"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          />
          <span className="mt-1 block text-[11px] leading-snug text-gray-500">
            Only needed for a participation %. Leave blank if you just want counts of people, marks,
            and hearts.
          </span>
        </label>
        <label className="block text-xs text-gray-400 sm:col-span-2">
          Campaign / show name
          <input
            type="text"
            value={campaignLabel}
            onChange={(e) => setCampaignLabel(e.target.value)}
            placeholder="e.g. Populus Thresholds"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <button
        type="button"
        className="text-[11px] text-gray-500 underline"
        onClick={() => setShowAdvancedSettings((v) => !v)}
      >
        {showAdvancedSettings ? "Hide more options" : "More options"}
      </button>
      {showAdvancedSettings ? (
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={populusPilot}
            onChange={(e) => setPopulusPilot(e.target.checked)}
            className="h-4 w-4"
          />
          Mark as Populus pilot garden
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#CFFF81] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleImpact()}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200 disabled:opacity-50"
        >
          Show impact
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void copyCreditsShare()}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200 disabled:opacity-50"
        >
          Share credits
        </button>
      </div>

      {notice ? <p className="text-xs text-amber-200">{notice}</p> : null}
      {settings ? (
        <p className="text-[11px] text-gray-500">
          {settings.identityMode === "open" ? "Anyone can join" : "Name + email required"}
          {settings.reachableAudience != null
            ? ` · room size ~${settings.reachableAudience}`
            : " · no room size set"}
          {settings.populusPilot ? " · Populus pilot" : ""}
        </p>
      ) : null}

      {index ? (
        <div className="space-y-2 rounded-lg border border-gray-800 bg-black/40 p-3">
          <p className="text-xs font-semibold text-white">Impact (for this campaign)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-[#0c0c0e] p-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Who showed up</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {index.participationRate != null
                  ? pct(index.participationRate)
                  : `${index.contributors}`}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {index.participationRate != null
                  ? `${index.contributors} of ~${index.reachableAudience}`
                  : "people who contributed (set room size for a %)"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-[#0c0c0e] p-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Activity</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {index.sponsoredParticipationVolume}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {index.contributionsInWindow} marks + {index.reactsInWindow} hearts
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-[#0c0c0e] p-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Heard it live</p>
              <p className="mt-1 text-lg font-semibold text-white">{index.activationReach}</p>
              <p className="mt-1 text-[11px] text-gray-500">
                credited people on performed pieces
              </p>
            </div>
          </div>
          {index.notes.length > 0 ? (
            <ul className="space-y-1 text-[11px] text-gray-500">
              {index.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {pack && pack.entries.length > 0 ? (
        <div className="rounded-lg border border-gray-800 bg-black/40 p-3">
          <p className="text-xs font-semibold text-white">Share credits</p>
          <p className="mt-1 text-[11px] text-gray-500">
            People who helped make this — for posts, programs, or sponsor decks.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-200">
            {pack.entries.slice(0, 16).map((e) => (
              <li key={`${e.sourceType}-${e.sourceId}`}>
                {e.creditName}
                {e.selected ? " · featured" : ""}
                {e.performed ? " · performed" : ""}
                {e.reactCount > 0 ? ` · ♥ ${e.reactCount}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Credits in the garden ({credits.length})
        </h3>
        {credits.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">
            No names yet — they appear when people leave marks with a name (or claim identity).
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-gray-300">
            {credits.slice(0, 12).map((c, i) => (
              <li key={`${c.creditName}-${i}`}>
                {c.creditName}
                {c.selected ? " · featured" : ""} · ♥ {c.reactCount}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Marks & culture ({contributions.length})
        </h3>
        <p className="mt-1 text-[11px] text-gray-500">
          Feature a mark to show it under Culture. Mark performed when it lands in a live show.
        </p>
        {contributions.length === 0 ? (
          <p className="mt-2 text-xs text-gray-600">
            Empty for now — open the public garden and leave a mark, or attach a show.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {contributions.slice(0, 20).map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-xs text-gray-300"
              >
                <span className="min-w-0 truncate">
                  {n.excerpt || n.kind} · {n.creditName || "Anonymous"} · ♥ {n.reactCount}
                  {n.selected ? " · featured" : ""}
                  {n.performed ? " · performed" : ""}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSelect(n)}
                    className="rounded border border-gray-600 px-2 py-1 text-[10px] hover:bg-white/5"
                  >
                    {n.selected ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || n.performed}
                    onClick={() => void handlePerform(n)}
                    className="rounded border border-gray-600 px-2 py-1 text-[10px] hover:bg-white/5 disabled:opacity-40"
                  >
                    Performed
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
