"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  status?: string;
  domain: string;
};

const settingsGroups: { heading: string; blurb: string; cards: SettingsCard[] }[] = [
  {
    heading: "Account",
    blurb: "Who you are in the system and how you sign in.",
    cards: [
      {
        domain: "Identity",
        title: "Profile",
        description: "Display name, contact email, and how you appear on outreach and facilitation tools.",
        href: "/admin/settings",
        status: "Coming next",
      },
      {
        domain: "Security",
        title: "Sign-in & access",
        description: "Password / magic-link preferences and session controls for admin access.",
        href: "/admin/settings",
        status: "Coming next",
      },
    ],
  },
  {
    heading: "Integrations",
    blurb: "External services that power enrichment, outreach, and generation across OCTO.",
    cards: [
      {
        domain: "Sales",
        title: "Hunter enrichment",
        description: "API key status, credit balance, and find/verify behavior for the queue.",
        href: "/admin/sales",
        status: "Open Sales",
      },
      {
        domain: "Sales",
        title: "Gmail outreach",
        description: "Connect inbox, pause/resume sending, reply sync, and nudge drafts.",
        href: "/admin/sales",
        status: "Open Sales",
      },
      {
        domain: "Sales",
        title: "Daily digest",
        description: "Internal morning digest of high-confidence leads (Resend).",
        href: "/admin/sales",
        status: "Open Sales",
      },
    ],
  },
  {
    heading: "Living system defaults",
    blurb: "Shared defaults that keep Gardens, Blooms, Roots, Live, and Composer coherent.",
    cards: [
      {
        domain: "Gardens",
        title: "World & brand defaults",
        description: "Default garden status, zone language, and public presentation preferences.",
        href: "/admin/gardens",
        status: "Open Gardens",
      },
      {
        domain: "Blooms",
        title: "Journey & consent",
        description: "Participant consent copy, name-step defaults, and contribution channel preferences.",
        href: "/admin/events",
        status: "Open Blooms",
      },
      {
        domain: "Roots",
        title: "Participation loop",
        description: "Invitation → recognition → response thresholds that protect the loop during Blooms.",
        href: "/admin/roots",
        status: "Open Roots",
      },
      {
        domain: "Live",
        title: "Runtime defaults",
        description: "Default live modes, signal fields, and session facilitation preferences.",
        href: "/admin/live",
        status: "Open Live",
      },
      {
        domain: "Composer",
        title: "Formation preferences",
        description: "Brief export formats, pad arrangement habits, and composition entry points.",
        href: "/admin/composer",
        status: "Open Composer",
      },
    ],
  },
  {
    heading: "Workspace",
    blurb: "Operator-facing preferences for this Crowdsource workspace.",
    cards: [
      {
        domain: "Appearance",
        title: "Design system",
        description:
          "Master CSS chrome: lime accent, transparent flush rows, hover outlines, circular buttons, and link color.",
        href: "/admin/settings/design-system",
        status: "Edit tokens",
      },
      {
        domain: "Appearance",
        title: "Admin chrome",
        description: "Sidebar open/closed state is saved in this browser. Shell background follows Design system.",
        href: "/admin/settings/design-system",
        status: "Active",
      },
      {
        domain: "Safety",
        title: "Danger zone",
        description: "Rare destructive actions (wipe submissions, disconnect integrations) stay confirm-gated.",
        href: "/admin/settings",
        status: "Policy",
      },
    ],
  },
];

function SettingsCardView({ card }: { card: SettingsCard }) {
  return (
    <Link
      href={card.href}
      className="rounded-xl border border-transparent bg-transparent p-5 transition-[outline-color] hover:outline hover:outline-[length:var(--csc-outline-width)] hover:outline-[var(--csc-accent)] hover:-outline-offset-1"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{card.domain}</p>
      <h3 className="mt-2 text-base font-semibold text-white">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-400">{card.description}</p>
      {card.status ? <span className="csc-link mt-4 inline-flex text-xs font-medium">{card.status} →</span> : null}
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
          One place to steer account identity, integrations, living-system defaults, and the shared visual chrome that
          keeps every admin page aligned.
        </p>
      </div>

      {settingsGroups.map((group) => (
        <Section key={group.heading} heading={group.heading} blurb={group.blurb}>
          {group.cards.map((card) => (
            <SettingsCardView key={`${group.heading}-${card.title}`} card={card} />
          ))}
        </Section>
      ))}
    </div>
  );
}
