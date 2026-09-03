"use client";

import { useEffect, type ReactNode } from "react";

export function SalesOverlay({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-lg rounded-xl border border-gray-800 bg-[#121214] p-5 shadow-2xl shadow-black/50"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SalesToolButton({
  label,
  status,
  tone = "neutral",
  onClick,
}: {
  label: string;
  status?: string | null;
  tone?: "neutral" | "ok" | "warn" | "error";
  onClick: () => void;
}) {
  const toneClass =
    tone === "ok"
      ? "border-[#CFFF81]/30 text-[#CFFF81]"
      : tone === "warn"
        ? "border-amber-700/60 text-amber-200"
        : tone === "error"
          ? "border-red-800/60 text-red-200"
          : "border-gray-700 text-gray-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-gray-800/80 ${toneClass}`}
    >
      {label}
      {status ? <span className="ml-2 text-xs opacity-70">{status}</span> : null}
    </button>
  );
}
