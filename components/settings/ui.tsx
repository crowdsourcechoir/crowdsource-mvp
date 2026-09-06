"use client";

import type { ReactNode } from "react";

/**
 * Shared primitives for `/admin/settings/*` pages.
 * Use these instead of inventing new panel / button / status styling.
 */

export function SettingsPanel({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-xl border border-[var(--csc-row-divider)] bg-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="csc-eyebrow">{eyebrow}</p> : null}
          <h2 className="mt-2 text-base font-semibold text-white">{title}</h2>
          {description ? <div className="mt-2 max-w-2xl text-sm text-gray-400">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type StatusTone = "ok" | "warn" | "off" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  ok: "border-[var(--csc-accent)] text-[var(--csc-accent)]",
  warn: "border-amber-400/60 text-amber-200",
  off: "border-red-500/50 text-red-200",
  neutral: "border-white/20 text-gray-300",
};

export function StatusPill({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function SettingsButton({
  children,
  onClick,
  disabled,
  variant = "ghost",
  type = "button",
  title,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** primary = selected/accent lime; ghost = idle gray pill; danger = destructive */
  variant?: "ghost" | "primary" | "danger";
  type?: "button" | "submit";
  title?: string;
  /** When set, renders as a same-styled link (e.g. Connect Gmail). */
  href?: string;
}) {
  // Match StatusPill: full pill, caps, tracked — selected stays lime, idle stays gray.
  const base =
    "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "border-[var(--csc-accent)] text-[var(--csc-accent)] hover:bg-[var(--csc-accent)] hover:text-black"
      : variant === "danger"
        ? "border-red-500/50 text-red-200 hover:border-red-400 hover:text-red-100"
        : "border-white/20 text-gray-300 hover:border-white/40 hover:text-white";

  if (href) {
    return (
      <a
        href={disabled ? undefined : href}
        title={title}
        aria-disabled={disabled || undefined}
        className={`${base} ${styles} ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-medium text-gray-300">{children}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number";
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[var(--csc-accent)] focus:outline-none disabled:opacity-50"
    />
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3 text-left transition-colors hover:border-[var(--csc-accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-gray-500">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--csc-accent)]" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
            checked ? "left-[1.125rem] bg-black" : "left-0.5 bg-white"
          }`}
        />
      </span>
    </button>
  );
}

export function InlineNote({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  const color =
    tone === "off"
      ? "text-red-200"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "ok"
          ? "text-[var(--csc-accent)]"
          : "text-gray-400";
  return <p className={`text-sm ${color}`}>{children}</p>;
}
