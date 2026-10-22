"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FLAGSHIP_OFFERS,
  FLAGSHIP_OFFER_KEYS,
  REVENUE_ENGINES,
  REVENUE_ENGINE_KEYS,
  formatUsd,
  readDealEconomics,
  readFlagshipOffer,
  readRevenueEngine,
  type DealEconomics,
  type FlagshipOfferKey,
  type RevenueEngineKey,
} from "@/lib/sales/engines";
import { apiErrorFromBody, publicErrorMessage } from "@/lib/sales/http-error";

type Suggestions = Record<FlagshipOfferKey, number>;

type Props = {
  opportunityId: string;
  importMetadata: Record<string, unknown> | null | undefined;
  /** When true, emphasize deal $ fields (Won column / Won detail). */
  showDealEconomics?: boolean;
  compact?: boolean;
  onUpdated?: (next: {
    importMetadata: Record<string, unknown> | null;
    revenueEngine: RevenueEngineKey | null;
    flagshipOffer: FlagshipOfferKey | null;
    dealEconomics: DealEconomics;
  }) => void;
};

export default function OpportunityPortfolioPanel({
  opportunityId,
  importMetadata,
  showDealEconomics = false,
  compact = false,
  onUpdated,
}: Props) {
  const [engine, setEngine] = useState<RevenueEngineKey | "">(readRevenueEngine(importMetadata) ?? "");
  const [offer, setOffer] = useState<FlagshipOfferKey | "">(readFlagshipOffer(importMetadata) ?? "");
  const economics = readDealEconomics(importMetadata);
  const [booked, setBooked] = useState(economics.bookedAmount != null ? String(economics.bookedAmount) : "");
  const [cash, setCash] = useState(economics.cashCollected != null ? String(economics.cashCollected) : "");
  const [earned, setEarned] = useState(economics.earnedAmount != null ? String(economics.earnedAmount) : "");
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setEngine(readRevenueEngine(importMetadata) ?? "");
    setOffer(readFlagshipOffer(importMetadata) ?? "");
    const next = readDealEconomics(importMetadata);
    setBooked(next.bookedAmount != null ? String(next.bookedAmount) : "");
    setCash(next.cashCollected != null ? String(next.cashCollected) : "");
    setEarned(next.earnedAmount != null ? String(next.earnedAmount) : "");
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
    offer && suggestions ? String(suggestions[offer]) : offer ? undefined : undefined;

  return (
    <div className={compact ? "mt-2 space-y-2" : "mt-4 space-y-3 rounded-xl border border-[var(--csc-row-divider)] p-3"}>
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

      {showDealEconomics ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Deal economics
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
                  const next = booked.trim() === "" ? null : Number(booked);
                  if ((current ?? null) === (Number.isFinite(next as number) ? next : null) || (booked.trim() === "" && current == null))
                    return;
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
