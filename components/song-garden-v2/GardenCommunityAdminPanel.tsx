"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommunitySettings, ContributionNode, IdentityMode } from "@/lib/platform-v2/types";

type Props = { gardenId: string };

/**
 * Admin: Platform V2 community spine settings + Index / credit-pack peek.
 */
export default function GardenCommunityAdminPanel({ gardenId }: Props) {
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [identityMode, setIdentityMode] = useState<IdentityMode>("open");
  const [reachableAudience, setReachableAudience] = useState("");
  const [campaignLabel, setCampaignLabel] = useState("");
  const [populusPilot, setPopulusPilot] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [indexJson, setIndexJson] = useState<string | null>(null);
  const [credits, setCredits] = useState<
    Array<{ creditName: string; kind: string; selected: boolean; reactCount: number }>
  >([]);
  const [contributions, setContributions] = useState<ContributionNode[]>([]);
  const [busy, setBusy] = useState(false);

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
      const audience = reachableAudience.trim()
        ? Number(reachableAudience)
        : null;
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
      setNotice("Community settings saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleIndex() {
    setBusy(true);
    try {
      const res = await fetch(`/api/gardens/${gardenId}/community/index`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Index failed");
      setIndexJson(JSON.stringify(body.index, null, 2));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Index failed");
    } finally {
      setBusy(false);
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
      if (!res.ok) throw new Error(body.error || "Select failed");
      await load();
      setNotice(node.selected ? "Unselected." : "Selected — recognition emitted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Select failed");
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
      if (!res.ok) throw new Error(body.error || "Perform failed");
      await load();
      setNotice("Marked performed — recognition emitted (Live seam).");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Perform failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-800 bg-[#121214] p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-white">Community spine (Platform V2)</h2>
        <p className="mt-1 text-xs text-gray-500">
          Identity mode, discoverable contributions, reacts, credit pack, and Participation Index.
          Song Garden journeys stay modality UX — this is the shared platform layer.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-400">
          Identity mode
          <select
            value={identityMode}
            onChange={(e) => setIdentityMode(e.target.value as IdentityMode)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          >
            <option value="open">Open — anonymous-first + optional claim</option>
            <option value="account_required">Account required — claim before contribute/react</option>
          </select>
        </label>
        <label className="block text-xs text-gray-400">
          Reachable audience (Index denominator)
          <input
            type="number"
            min={1}
            value={reachableAudience}
            onChange={(e) => setReachableAudience(e.target.value)}
            placeholder="e.g. 400 for Populus"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-gray-400 sm:col-span-2">
          Campaign label
          <input
            type="text"
            value={campaignLabel}
            onChange={(e) => setCampaignLabel(e.target.value)}
            placeholder="Populus Thresholds R&D"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-[#0c0c0e] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-300 sm:col-span-2">
          <input
            type="checkbox"
            checked={populusPilot}
            onChange={(e) => setPopulusPilot(e.target.checked)}
            className="h-4 w-4"
          />
          Populus pilot garden
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-lg bg-[#CFFF81] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          Save community
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleIndex()}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200 disabled:opacity-50"
        >
          Compute Index
        </button>
        <a
          href={`/api/gardens/${gardenId}/community/credit-pack`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200"
        >
          Open credit pack JSON
        </a>
      </div>

      {notice ? <p className="text-xs text-amber-200">{notice}</p> : null}
      {settings ? (
        <p className="font-mono text-[10px] text-gray-500">
          mode={settings.identityMode} · audience={settings.reachableAudience ?? "—"} · populus=
          {settings.populusPilot ? "yes" : "no"}
        </p>
      ) : null}

      {indexJson ? (
        <pre className="max-h-48 overflow-auto rounded-lg border border-gray-800 bg-black/40 p-3 font-mono text-[10px] text-gray-300">
          {indexJson}
        </pre>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          In-Garden credits ({credits.length})
        </h3>
        {credits.length === 0 ? (
          <p className="mt-1 text-xs text-gray-600">No credited contributions yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-gray-300">
            {credits.slice(0, 12).map((c, i) => (
              <li key={`${c.creditName}-${i}`}>
                {c.creditName} · {c.kind}
                {c.selected ? " · selected" : ""} · ♥ {c.reactCount}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Contribution graph ({contributions.length})
        </h3>
        <ul className="mt-2 space-y-2">
          {contributions.slice(0, 20).map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-black/30 px-3 py-2 text-xs text-gray-300"
            >
              <span className="min-w-0 truncate">
                {n.creditName || "Anonymous"} · {n.sourceType}/{n.sourceId.slice(0, 8)} · ♥{" "}
                {n.reactCount}
                {n.selected ? " · selected" : ""}
                {n.performed ? " · performed" : ""}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSelect(n)}
                  className="rounded border border-gray-600 px-2 py-1 text-[10px] hover:bg-white/5"
                >
                  {n.selected ? "Unselect" : "Select"}
                </button>
                <button
                  type="button"
                  disabled={busy || n.performed}
                  onClick={() => void handlePerform(n)}
                  className="rounded border border-gray-600 px-2 py-1 text-[10px] hover:bg-white/5 disabled:opacity-40"
                >
                  Perform
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
