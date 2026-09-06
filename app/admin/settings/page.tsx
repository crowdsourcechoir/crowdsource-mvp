"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SETTINGS_GROUPS, type SettingsCard } from "@/lib/settings/catalog";

function SettingsCardView({ card }: { card: SettingsCard }) {
  return (
    <Link
      href={card.href}
      className="rounded-xl border border-transparent bg-transparent p-5 transition-[outline-color] hover:outline hover:outline-[length:var(--csc-outline-width)] hover:outline-[var(--csc-accent)] hover:-outline-offset-1"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{card.domain}</p>
      <h3 className="mt-2 text-base font-semibold text-white">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-400">{card.description}</p>
      <span className="csc-link mt-4 inline-flex text-xs font-medium">{card.statusLabel} →</span>
    </Link>
  );
}

function Section({
  heading,
  blurb,
  children,
}: {
  heading: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{heading}</h2>
        <p className="mt-1 text-sm text-gray-400">{blurb}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="w-full space-y-10 text-white">
      <div className="mb-2 sm:mb-4">
        <p className="csc-eyebrow">OCTO Control</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Master controls for identity, integrations, living-system defaults, and shared chrome. Feature pages run the
          work; Settings steers how the system looks and behaves.
        </p>
      </div>

      {SETTINGS_GROUPS.map((group) => (
        <Section key={group.id} heading={group.heading} blurb={group.blurb}>
          {group.cards.map((card) => (
            <SettingsCardView key={card.id} card={card} />
          ))}
        </Section>
      ))}
    </div>
  );
}
