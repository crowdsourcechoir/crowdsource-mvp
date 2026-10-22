"use client";

import { useEffect, useId, useRef, useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Sunday-based index of the 1st of the month (0 = Sunday). */
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function formatDisplay(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return "";
  return `${pad2(parsed.month)}/${pad2(parsed.day)}/${parsed.year}`;
}

function todayYmd(): string {
  const now = new Date();
  return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type CscDatePickerProps = {
  value: string;
  onChange: (ymd: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * Design-system date picker — black shell, accent selection.
 * Replaces native `<input type="date">` whose OS popup is stuck on gray/blue chrome.
 */
export default function CscDatePicker({
  value,
  onChange,
  onClear,
  disabled = false,
  id,
  className = "",
}: CscDatePickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseYmd(value);
  const initial = selected ?? parseYmd(todayYmd())!;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  useEffect(() => {
    if (!open) return;
    const next = selected ?? parseYmd(todayYmd())!;
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth() + 1);
  }

  const dim = daysInMonth(viewYear, viewMonth);
  const lead = firstWeekday(viewYear, viewMonth);
  const today = todayYmd();
  const cells: { ymd: string; day: number; inMonth: boolean }[] = [];

  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
  const prevDim = daysInMonth(prevYear, prevMonth);
  for (let i = lead - 1; i >= 0; i -= 1) {
    const day = prevDim - i;
    cells.push({ ymd: toYmd(prevYear, prevMonth, day), day, inMonth: false });
  }
  for (let day = 1; day <= dim; day += 1) {
    cells.push({ ymd: toYmd(viewYear, viewMonth, day), day, inMonth: true });
  }
  const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
  const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: toYmd(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false });
    nextDay += 1;
  }

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[9.5rem] items-center justify-between gap-2 rounded-lg border border-white/15 bg-[var(--csc-shell-bg,#000)] px-2.5 py-1.5 text-left text-xs text-white transition-colors hover:border-[var(--csc-accent)] focus:border-[var(--csc-accent)] focus:outline-none disabled:opacity-50"
      >
        <span className={value ? "text-white" : "text-gray-500"}>{value ? formatDisplay(value) : "Pick a date"}</span>
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--csc-accent)]">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-50 mt-1.5 w-[17.5rem] rounded-lg border border-white/15 bg-[var(--csc-shell-bg,#000)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{monthLabel(viewYear, viewMonth)}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-gray-300 transition-colors hover:border-[var(--csc-accent)] hover:text-white"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {WEEKDAYS.map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((cell) => {
              const isSelected = cell.ymd === value;
              const isToday = cell.ymd === today;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => {
                    onChange(cell.ymd);
                    setOpen(false);
                  }}
                  className={[
                    "flex h-8 items-center justify-center rounded-md text-xs transition-colors",
                    cell.inMonth ? "text-white" : "text-gray-600",
                    isSelected
                      ? "bg-[var(--csc-accent)] font-semibold text-black"
                      : isToday
                        ? "border border-[var(--csc-accent)]/70 text-white hover:bg-white/5"
                        : "hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            <button
              type="button"
              className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
              onClick={() => {
                onClear?.();
                if (!onClear) onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="csc-link text-xs font-semibold uppercase tracking-[0.14em]"
              onClick={() => {
                const ymd = todayYmd();
                onChange(ymd);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
