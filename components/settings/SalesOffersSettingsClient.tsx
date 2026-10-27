"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FieldLabel,
  InlineNote,
  SettingsButton,
  SettingsPanel,
  Stat,
  StatGrid,
  TextField,
} from "@/components/settings/ui";
import {
  DEFAULT_PACKAGE_SUGGESTIONS,
  FLAGSHIP_OFFERS,
  REVENUE_ENGINES,
  RUN_RATE_TARGETS,
  formatUsd,
} from "@/lib/sales/engines";
import { PLAYBOOK, WORKSTREAM_KEYS, WORKSTREAMS } from "@/lib/sales/strategy/playbook";

type OffersSettingsResponse = {
  suggestions: {
    anthem_experience: number;
    crowdsource_partnership: number;
    song_garden: number;
  };
  overrides: {
    anthemExperienceAmount: number | null;
    partnershipMonthlyAmount: number | null;
    songGardenAmount: number | null;
  };
  persisted: boolean;
  storeError: string | null;
  error?: string;
};

export default function SalesOffersSettingsClient() {
  const [settings, setSettings] = useState<OffersSettingsResponse | null>(null);
  const [anthem, setAnthem] = useState("");
  const [partnership, setPartnership] = useState("");
  const [songGarden, setSongGarden] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((data: OffersSettingsResponse) => {
    setSettings(data);
    setAnthem(String(data.suggestions.anthem_experience));
    setPartnership(String(data.suggestions.crowdsource_partnership));
    setSongGarden(String(data.suggestions.song_garden));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/offers/settings", { cache: "no-store" });
      const data = (await res.json()) as OffersSettingsResponse;
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      apply(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers settings");
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/offers/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthemExperienceAmount: anthem.trim() === "" ? null : Number(anthem),
          partnershipMonthlyAmount: partnership.trim() === "" ? null : Number(partnership),
          songGardenAmount: songGarden.trim() === "" ? null : Number(songGarden),
        }),
      });
      const data = (await res.json()) as OffersSettingsResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      apply(data);
      setMessage("Saved suggested package amounts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaults() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/sales/offers/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthemExperienceAmount: null,
          partnershipMonthlyAmount: null,
          songGardenAmount: null,
        }),
      });
      const data = (await res.json()) as OffersSettingsResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not reset");
      apply(data);
      setMessage("Reset to built-in package suggestions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <InlineNote>{message}</InlineNote> : null}
      {settings?.storeError ? <InlineNote>Store: {settings.storeError}</InlineNote> : null}

      <SettingsPanel
        title="Run-rate targets"
        description="Gross business revenue context for Sales — not take-home or a separate finance app."
      >
        <StatGrid>
          <Stat label="Survival floor" value={`${formatUsd(RUN_RATE_TARGETS.survival)}/mo`} />
          <Stat label="Operating baseline" value={`${formatUsd(RUN_RATE_TARGETS.baseline)}/mo`} />
          <Stat label="Growth · Dec 2027" value={`${formatUsd(RUN_RATE_TARGETS.growth)}/mo`} />
        </StatGrid>
      </SettingsPanel>

      <SettingsPanel
        title="Business card scan"
        description="Conference-floor capture on Sales queue (+ card button). Uses OPENAI_API_KEY vision; new contacts default to Interest."
      >
        <p className="text-sm text-gray-400">
          Snap or choose a photo → review fields → Save to Interest. Queues for send when email is deliverable.
          Default category: Conferences & associations.
        </p>
      </SettingsPanel>

      <SettingsPanel
        title="Revenue playbook"
        description={`${PLAYBOOK.framing}. 90-day effort mix that Sales home and the queue Work filter follow.`}
      >
        <ul className="csc-list">
          {WORKSTREAM_KEYS.map((key) => {
            const lane = WORKSTREAMS[key];
            return (
              <li key={key} className="csc-list-row flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    <span className="text-[var(--csc-accent)]">{lane.effortPct}%</span> {lane.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{lane.action}</p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {lane.dealMath} · {formatUsd(lane.annualTargetUsd)}/yr
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 space-y-1.5 text-xs text-gray-500">
          <p>
            <span className="text-gray-400">Booking rule:</span> {PLAYBOOK.bookingRule}
          </p>
          <p>
            <span className="text-gray-400">Operating rule:</span> {PLAYBOOK.operatingRule}
          </p>
          <p>
            <span className="text-gray-400">Weekly scorecard:</span> {PLAYBOOK.weeklyScorecard}
          </p>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Revenue engines">
        <ul className="csc-list">
          {Object.values(REVENUE_ENGINES).map((engine) => (
            <li key={engine.key} className="csc-list-row flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{engine.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{engine.description}</p>
              </div>
              <p className="shrink-0 text-xs text-gray-400">
                Default: {FLAGSHIP_OFFERS[engine.defaultOfferKey].label}
              </p>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel title="Flagship offers">
        <ul className="csc-list">
          {Object.values(FLAGSHIP_OFFERS).map((offer) => (
            <li key={offer.key} className="csc-list-row flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{offer.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{offer.description}</p>
              </div>
              <p className="shrink-0 text-xs text-[var(--csc-accent)]">
                {REVENUE_ENGINES[offer.engine].label}
              </p>
            </li>
          ))}
        </ul>
      </SettingsPanel>

      <SettingsPanel
        title="Suggested package amounts"
        description={`Placeholders when recording booked value on Won deals. Built-in: Anthem ${formatUsd(DEFAULT_PACKAGE_SUGGESTIONS.anthem_experience)}, Partnership ${formatUsd(DEFAULT_PACKAGE_SUGGESTIONS.crowdsource_partnership)}/mo, Song Garden ${formatUsd(DEFAULT_PACKAGE_SUGGESTIONS.song_garden)}.`}
        actions={
          <>
            <SettingsButton variant="primary" onClick={() => void save()} disabled={busy}>
              Save amounts
            </SettingsButton>
            <SettingsButton onClick={() => void resetDefaults()} disabled={busy}>
              Reset to defaults
            </SettingsButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel>Anthem Experience ($)</FieldLabel>
            <TextField
              type="number"
              value={anthem}
              onChange={setAnthem}
              disabled={busy}
              placeholder={String(DEFAULT_PACKAGE_SUGGESTIONS.anthem_experience)}
            />
          </div>
          <div>
            <FieldLabel>Partnership / month ($)</FieldLabel>
            <TextField
              type="number"
              value={partnership}
              onChange={setPartnership}
              disabled={busy}
              placeholder={String(DEFAULT_PACKAGE_SUGGESTIONS.crowdsource_partnership)}
            />
          </div>
          <div>
            <FieldLabel>Song Garden ($)</FieldLabel>
            <TextField
              type="number"
              value={songGarden}
              onChange={setSongGarden}
              disabled={busy}
              placeholder={String(DEFAULT_PACKAGE_SUGGESTIONS.song_garden)}
            />
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}
