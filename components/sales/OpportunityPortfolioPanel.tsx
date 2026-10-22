"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CscDatePicker from "@/components/ui/CscDatePicker";
import {
  FLAGSHIP_OFFERS,
  FLAGSHIP_OFFER_KEYS,
  PREMIUM_DEAL_QUICK_AMOUNTS,
  REVENUE_ENGINES,
  REVENUE_ENGINE_KEYS,
  formatUsd,
  readDealEconomics,
  readDealForecast,
  readFlagshipOffer,
  readRevenueEngine,
  splitPotentialHalves,
  type DealEconomics,
  type DealForecast,
  type FlagshipOfferKey,
  type RevenueEngineKey,
} from "@/lib/sales/engines";
import { apiErrorFromBody, publicErrorMessage } from "@/lib/sales/http-error";

type Suggestions = Record<FlagshipOfferKey, number>;

type Props = {
  opportunityId: string;
  importMetadata: Record<string, unknown> | null | undefined;
  /** When true, show booked / cash / earned (Won). */
  showDealEconomics?: boolean;
  /** Potential deal $ + payment schedule — default on for queue. */
  showDealForecast?: boolean;
  compact?: boolean;
  onUpdated?: (next: {
    importMetadata: Record<string, unknown> | null;
    revenueEngine: RevenueEngineKey | null;
    flagshipOffer: FlagshipOfferKey | null;
    dealEconomics: DealEconomics;
    dealForecast: DealForecast;
  }) => void;
};

function moneyDraft(value: number | null): string {
  return value != null ? String(value) : "";
}

function formatShortDate(ymd: string | null): string {
  if (!ymd) return "Date";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${m}/${d}/${y.slice(2)}`;
}

export default function OpportunityPortfolioPanel({
  opportunityId,
  importMetadata,
  showDealEconomics = false,
  showDealForecast = true,
  compact = false,
  onUpdated,
}: Props) {
  const [engine, setEngine] = useState<RevenueEngineKey | "">(readRevenueEngine(importMetadata) ?? "");
  const [offer, setOffer] = useState<FlagshipOfferKey | "">(readFlagshipOffer(importMetadata) ?? "");
  const economics = readDealEconomics(importMetadata);
  const forecast = readDealForecast(importMetadata);
  const [booked, setBooked] = useState(moneyDraft(economics.bookedAmount));
  const [cash, setCash] = useState(moneyDraft(economics.cashCollected));
  const [earned, setEarned] = useState(moneyDraft(economics.earnedAmount));
  const [potential, setPotential] = useState(moneyDraft(forecast.potentialAmount));
  const [firstAmount, setFirstAmount] = useState(moneyDraft(forecast.firstPaymentAmount));
  const [secondAmount, setSecondAmount] = useState(moneyDraft(forecast.secondPaymentAmount));
  const [firstAt, setFirstAt] = useState(forecast.firstPaymentAt ?? "");
  const [secondAt, setSecondAt] = useState(forecast.secondPaymentAt ?? "");
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [customDeal, setCustomDeal] = useState(false);

  useEffect(() => {
    setEngine(readRevenueEngine(importMetadata) ?? "");
    setOffer(readFlagshipOffer(importMetadata) ?? "");
    const nextEcon = readDealEconomics(importMetadata);
    setBooked(moneyDraft(nextEcon.bookedAmount));
    setCash(moneyDraft(nextEcon.cashCollected));
    setEarned(moneyDraft(nextEcon.earnedAmount));
    const nextForecast = readDealForecast(importMetadata);
    setPotential(moneyDraft(nextForecast.potentialAmount));
    setFirstAmount(moneyDraft(nextForecast.firstPaymentAmount));
    setSecondAmount(moneyDraft(nextForecast.secondPaymentAmount));
    setFirstAt(nextForecast.firstPaymentAt ?? "");
    setSecondAt(nextForecast.secondPaymentAt ?? "");
    const preset = nextForecast.potentialAmount;
    setCustomDeal(
      preset != null && !(PREMIUM_DEAL_QUICK_AMOUNTS as readonly number[]).includes(preset)
    );
  }, [importMetadata]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales/offers/settings", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || cancelled) return;
        if (data.suggestions) setSuggestions(data.suggestions as Suggestions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback(
    async (body: Record<string, unknown>, note: string) => {
      setBusy(true);
      setError(null);
      setSavedNote(null);
      try {
        const res = await fetch(`/api/sales/opportunities/${opportunityId}/portfolio`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not save"));
        const meta = (data.opportunity?.importMetadata ?? null) as Record<string, unknown> | null;
        onUpdated?.({
          importMetadata: meta,
          revenueEngine: data.revenueEngine ?? null,
          flagshipOffer: data.flagshipOffer ?? null,
          dealEconomics: data.dealEconomics ?? readDealEconomics(meta),
          dealForecast: data.dealForecast ?? readDealForecast(meta),
        });
        setSavedNote(note);
      } catch (err) {
        setError(publicErrorMessage(err, "Could not save"));
      } finally {
        setBusy(false);
      }
    },
    [opportunityId, onUpdated]
  );

  const selectClass =
    "rounded-md border border-white/15 bg-black px-2 py-1.5 text-xs text-white focus:border-[var(--csc-accent)] focus:outline-none";
  const inputClass =
    "w-full min-w-0 rounded-md border border-white/15 bg-black px-2 py-1.5 text-xs text-white tabular-nums focus:border-[var(--csc-accent)] focus:outline-none";

  const placeholderForOffer = offer && suggestions ? String(suggestions[offer]) : undefined;

  const dealPresets = useMemo(() => {
    const base =
      engine === "premium" || offer === "anthem_experience"
        ? [...PREMIUM_DEAL_QUICK_AMOUNTS]
        : placeholderForOffer
          ? [Number(placeholderForOffer)].filter((n) => Number.isFinite(n) && n > 0)
          : [...PREMIUM_DEAL_QUICK_AMOUNTS];
    return Array.from(new Set(base));
  }, [engine, offer, placeholderForOffer]);

  const dealSelectValue = customDeal
    ? "custom"
    : forecast.potentialAmount != null && dealPresets.includes(forecast.potentialAmount)
      ? String(forecast.potentialAmount)
      : forecast.potentialAmount != null
        ? "custom"
        : "";

  const cashSummary = useMemo(() => {
    if (
      forecast.firstPaymentAmount == null &&
      forecast.secondPaymentAmount == null &&
      !forecast.firstPaymentAt &&
      !forecast.secondPaymentAt
    ) {
      return "Cash schedule";
    }
    const a = forecast.firstPaymentAmount != null ? formatUsd(forecast.firstPaymentAmount) : "—";
    const b = forecast.secondPaymentAmount != null ? formatUsd(forecast.secondPaymentAmount) : "—";
    return `${a} ${formatShortDate(forecast.firstPaymentAt)} · ${b} ${formatShortDate(forecast.secondPaymentAt)}`;
  }, [forecast]);

  function applyPotential(amount: number) {
    const halves = splitPotentialHalves(amount);
    setPotential(String(amount));
    setFirstAmount(String(halves.first));
    setSecondAmount(String(halves.second));
    setCustomDeal(false);
    void patch(
      { potentialAmount: amount, splitHalves: true },
      `${formatUsd(amount)} potential · 50/50`
    );
  }

  async function savePotential(raw: string) {
    const trimmed = raw.trim();
    const current = readDealForecast(importMetadata).potentialAmount;
    if (trimmed === "" && current == null) return;
    if (current != null && String(current) === trimmed) return;
    const n = Number(trimmed.replace(/[$,\s]/g, ""));
    if (trimmed !== "" && Number.isFinite(n) && n > 0) {
      const halves = splitPotentialHalves(n);
      setFirstAmount(String(halves.first));
      setSecondAmount(String(halves.second));
      await patch({ potentialAmount: trimmed, splitHalves: true }, "Potential deal saved");
      return;
    }
    await patch({ potentialAmount: trimmed === "" ? null : trimmed }, "Potential deal saved");
  }

  return (
    <div
      className={
        compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2 rounded-xl border border-[var(--csc-row-divider)] px-3 py-2.5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!compact ? <p className="csc-eyebrow shrink-0">Portfolio</p> : null}
          <select
            aria-label="Revenue engine"
            className={selectClass}
            value={engine}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as RevenueEngineKey | "";
              setEngine(next);
              void patch({ revenueEngine: next === "" ? null : next }, "Engine saved");
            }}
          >
            <option value="">Engine…</option>
            {REVENUE_ENGINE_KEYS.map((key) => (
              <option key={key} value={key}>
                {REVENUE_ENGINES[key].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Flagship offer"
            className={selectClass}
            value={offer}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as FlagshipOfferKey | "";
              setOffer(next);
              void patch({ flagshipOffer: next === "" ? null : next }, "Offer saved");
            }}
          >
            <option value="">Offer…</option>
            {FLAGSHIP_OFFER_KEYS.map((key) => (
              <option key={key} value={key}>
                {FLAGSHIP_OFFERS[key].label}
              </option>
            ))}
          </select>
        </div>

        {showDealForecast ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">Deal</span>
              <select
                aria-label="Potential deal value"
                className={`${selectClass} min-w-[7.5rem] tabular-nums`}
                value={dealSelectValue}
                disabled={busy}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setCustomDeal(false);
                    setPotential("");
                    void patch({ potentialAmount: null }, "Potential cleared");
                    return;
                  }
                  if (v === "custom") {
                    setCustomDeal(true);
                    return;
                  }
                  applyPotential(Number(v));
                }}
              >
                <option value="">Value…</option>
                {dealPresets.map((amount) => (
                  <option key={amount} value={String(amount)}>
                    {formatUsd(amount)}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {customDeal || dealSelectValue === "custom" ? (
              <input
                aria-label="Custom deal value"
                className={`${inputClass} w-[5.5rem]`}
                inputMode="decimal"
                placeholder={placeholderForOffer ?? "15000"}
                value={potential}
                disabled={busy}
                onChange={(e) => setPotential(e.target.value)}
                onBlur={() => void savePotential(potential)}
              />
            ) : null}

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">1st</span>
              <CscDatePicker
                value={firstAt}
                disabled={busy}
                onChange={(ymd) => {
                  setFirstAt(ymd);
                  void patch({ firstPaymentAt: ymd || null }, "First payment date saved");
                }}
                onClear={() => {
                  setFirstAt("");
                  void patch({ firstPaymentAt: null }, "First payment date cleared");
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">2nd</span>
              <CscDatePicker
                value={secondAt}
                disabled={busy}
                onChange={(ymd) => {
                  setSecondAt(ymd);
                  void patch({ secondPaymentAt: ymd || null }, "Second payment date saved");
                }}
                onClear={() => {
                  setSecondAt("");
                  void patch({ secondPaymentAt: null }, "Second payment date cleared");
                }}
              />
            </div>

            <button
              type="button"
              disabled={busy}
              aria-expanded={cashOpen}
              onClick={() => setCashOpen((v) => !v)}
              className={`max-w-[14rem] truncate rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-50 ${
                cashOpen
                  ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                  : "border-white/15 text-gray-300 hover:border-white/30 hover:text-white"
              }`}
              title={cashSummary}
            >
              {cashOpen ? "Hide halves" : cashSummary}
            </button>
          </div>
        ) : null}
      </div>

      {showDealForecast && cashOpen ? (
        <div className="flex flex-wrap items-end justify-end gap-2 border-t border-[var(--csc-row-divider)] pt-2">
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">1st $</span>
            <input
              className={`${inputClass} w-[5.5rem]`}
              inputMode="decimal"
              value={firstAmount}
              disabled={busy}
              onChange={(e) => setFirstAmount(e.target.value)}
              onBlur={() => {
                const current = readDealForecast(importMetadata).firstPaymentAmount;
                if (firstAmount.trim() === "" && current == null) return;
                if (current != null && String(current) === firstAmount.trim()) return;
                void patch(
                  { firstPaymentAmount: firstAmount.trim() === "" ? null : firstAmount },
                  "First payment amount saved"
                );
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">2nd $</span>
            <input
              className={`${inputClass} w-[5.5rem]`}
              inputMode="decimal"
              value={secondAmount}
              disabled={busy}
              onChange={(e) => setSecondAmount(e.target.value)}
              onBlur={() => {
                const current = readDealForecast(importMetadata).secondPaymentAmount;
                if (secondAmount.trim() === "" && current == null) return;
                if (current != null && String(current) === secondAmount.trim()) return;
                void patch(
                  { secondPaymentAmount: secondAmount.trim() === "" ? null : secondAmount },
                  "Second payment amount saved"
                );
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !potential.trim()}
            onClick={() => {
              const n = Number(potential.replace(/[$,\s]/g, ""));
              if (!Number.isFinite(n) || n <= 0) return;
              const halves = splitPotentialHalves(n);
              setFirstAmount(String(halves.first));
              setSecondAmount(String(halves.second));
              void patch({ potentialAmount: potential.trim(), splitHalves: true }, "Split 50/50");
            }}
            className="rounded-md border border-white/15 px-2 py-1.5 text-[11px] text-gray-300 hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
          >
            Split 50/50
          </button>
        </div>
      ) : null}

      {showDealEconomics ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--csc-row-divider)] pt-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Signed</span>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Booked</span>
            <input
              className={`${inputClass} w-[5.5rem]`}
              inputMode="decimal"
              placeholder={placeholderForOffer}
              value={booked}
              disabled={busy}
              onChange={(e) => setBooked(e.target.value)}
              onBlur={() => {
                const current = readDealEconomics(importMetadata).bookedAmount;
                if (booked.trim() === "" && current == null) return;
                if (current != null && String(current) === booked.trim()) return;
                void patch({ bookedAmount: booked.trim() === "" ? null : booked }, "Booked saved");
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Cash</span>
            <input
              className={`${inputClass} w-[5.5rem]`}
              inputMode="decimal"
              value={cash}
              disabled={busy}
              onChange={(e) => setCash(e.target.value)}
              onBlur={() => {
                const current = readDealEconomics(importMetadata).cashCollected;
                if (cash.trim() === "" && current == null) return;
                if (current != null && String(current) === cash.trim()) return;
                void patch({ cashCollected: cash.trim() === "" ? null : cash }, "Cash saved");
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Earned</span>
            <input
              className={`${inputClass} w-[5.5rem]`}
              inputMode="decimal"
              value={earned}
              disabled={busy}
              onChange={(e) => setEarned(e.target.value)}
              onBlur={() => {
                const current = readDealEconomics(importMetadata).earnedAmount;
                if (earned.trim() === "" && current == null) return;
                if (current != null && String(current) === earned.trim()) return;
                void patch({ earnedAmount: earned.trim() === "" ? null : earned }, "Earned saved");
              }}
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {savedNote ? <p className="text-xs text-[var(--csc-accent)]">{savedNote}</p> : null}
    </div>
  );
}
