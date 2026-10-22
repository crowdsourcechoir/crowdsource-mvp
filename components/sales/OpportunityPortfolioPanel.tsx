"use client";

import { useCallback, useEffect, useState } from "react";
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
    "w-full rounded-md border border-white/15 bg-black px-2 py-1.5 text-xs text-white tabular-nums focus:border-[var(--csc-accent)] focus:outline-none";

  const placeholderForOffer =
    offer && suggestions ? String(suggestions[offer]) : undefined;

  const quickAmounts =
    engine === "premium" || offer === "anthem_experience"
      ? [...PREMIUM_DEAL_QUICK_AMOUNTS]
      : placeholderForOffer
        ? [Number(placeholderForOffer)].filter((n) => Number.isFinite(n) && n > 0)
        : [];

  async function savePotential(raw: string, opts?: { split?: boolean; note?: string }) {
    const trimmed = raw.trim();
    const current = readDealForecast(importMetadata).potentialAmount;
    if (trimmed === "" && current == null) return;
    if (current != null && String(current) === trimmed && !opts?.split) return;
    await patch(
      {
        potentialAmount: trimmed === "" ? null : trimmed,
        ...(opts?.split ? { splitHalves: true } : {}),
      },
      opts?.note ?? "Potential deal saved"
    );
  }

  return (
    <div
      className={
        compact ? "mt-2 space-y-2" : "mt-4 space-y-3 rounded-xl border border-[var(--csc-row-divider)] p-3"
      }
    >
      {!compact ? <p className="csc-eyebrow">Portfolio</p> : null}
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-2"}`}>
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
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Potential deal
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] text-gray-500">Deal value ($)</span>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder={placeholderForOffer ?? "15000"}
              value={potential}
              disabled={busy}
              onChange={(e) => setPotential(e.target.value)}
              onBlur={() => void savePotential(potential)}
            />
          </label>
          {quickAmounts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPotential(String(amount));
                    const halves = splitPotentialHalves(amount);
                    setFirstAmount(String(halves.first));
                    setSecondAmount(String(halves.second));
                    void patch(
                      { potentialAmount: amount, splitHalves: true },
                      `${formatUsd(amount)} potential · 50/50 split`
                    );
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                    forecast.potentialAmount === amount
                      ? "border-[var(--csc-accent)] text-[var(--csc-accent)]"
                      : "border-white/15 text-gray-300 hover:border-[var(--csc-accent)] hover:text-white"
                  }`}
                >
                  {formatUsd(amount)}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || !potential.trim()}
                onClick={() => {
                  const n = Number(potential.replace(/[$,\s]/g, ""));
                  if (!Number.isFinite(n) || n <= 0) return;
                  const halves = splitPotentialHalves(n);
                  setFirstAmount(String(halves.first));
                  setSecondAmount(String(halves.second));
                  void patch(
                    {
                      potentialAmount: potential.trim(),
                      splitHalves: true,
                    },
                    "Split 50/50"
                  );
                }}
                className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
              >
                Split 50/50
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !potential.trim()}
              onClick={() => void savePotential(potential, { split: true, note: "Split 50/50" })}
              className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:border-[var(--csc-accent)] hover:text-white disabled:opacity-50"
            >
              Split 50/50
            </button>
          )}

          <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Expected cash
          </p>
          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
            <div className="space-y-2 rounded-lg border border-white/10 p-2.5">
              <p className="text-[11px] text-gray-400">First payment (deposit / half)</p>
              <label className="block">
                <span className="mb-1 block text-[11px] text-gray-500">Amount ($)</span>
                <input
                  className={inputClass}
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
              <div>
                <span className="mb-1 block text-[11px] text-gray-500">Expected date</span>
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
            </div>
            <div className="space-y-2 rounded-lg border border-white/10 p-2.5">
              <p className="text-[11px] text-gray-400">Second payment (balance / half)</p>
              <label className="block">
                <span className="mb-1 block text-[11px] text-gray-500">Amount ($)</span>
                <input
                  className={inputClass}
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
              <div>
                <span className="mb-1 block text-[11px] text-gray-500">Expected date</span>
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
            </div>
          </div>
          {forecast.potentialAmount != null ? (
            <p className="text-[11px] text-gray-500">
              {formatUsd(forecast.potentialAmount)} potential
              {forecast.firstPaymentAmount != null || forecast.secondPaymentAmount != null
                ? ` · ${formatUsd(forecast.firstPaymentAmount)} then ${formatUsd(forecast.secondPaymentAmount)}`
                : ""}
              {forecast.firstPaymentAt || forecast.secondPaymentAt
                ? ` · ${forecast.firstPaymentAt ?? "—"} / ${forecast.secondPaymentAt ?? "—"}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {showDealEconomics ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Deal economics (signed)
          </p>
          <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-3"}`}>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">Booked</span>
              <input
                className={inputClass}
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
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">Cash collected</span>
              <input
                className={inputClass}
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
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">Earned</span>
              <input
                className={inputClass}
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
          {(economics.bookedAmount != null ||
            economics.cashCollected != null ||
            economics.earnedAmount != null) && (
            <p className="text-[11px] text-gray-500">
              {formatUsd(economics.bookedAmount)} booked · {formatUsd(economics.cashCollected)} cash ·{" "}
              {formatUsd(economics.earnedAmount)} earned
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {savedNote ? <p className="text-xs text-[var(--csc-accent)]">{savedNote}</p> : null}
    </div>
  );
}
