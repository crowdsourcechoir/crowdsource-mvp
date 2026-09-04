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
        href: "/admin/settings#profile",
        status: "Coming next",
      },
      {
        domain: "Security",
        title: "Sign-in & access",
        description: "Password / magic-link preferences and session controls for admin access.",
        href: "/admin/settings#access",
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
        description: "API key status, credit balance, and find/verify behavior for the approval queue.",
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
        title: "Admin chrome",
        description: "Navigation collapse state is saved in this browser. True-black shell is the system default.",
        href: "/admin/settings#appearance",
        status: "Active",
      },
      {
        domain: "Safety",
        title: "Danger zone",
        description: "Rare destructive actions (wipe submissions, disconnect integrations) stay confirm-gated.",
        href: "/admin/settings#danger",
        status: "Policy",
      },
    ],
  },
];

function SettingsCardView({ card }: { card: SettingsCard }) {
  return (
    <Link
      href={card.href}
      className="rounded-xl border border-white/10 bg-[#0a0a0a] p-5 transition hover:border-[#CFFF81]/40 hover:bg-[#111]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{card.domain}</p>
      <h3 className="mt-2 text-base font-semibold text-white">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-400">{card.description}</p>
      {card.status ? (
        <span className="mt-4 inline-flex text-xs font-medium text-[#CFFF81]">{card.status} →</span>
      ) : null}
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
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#CFFF81]">OCTO Control</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          One place to steer account identity, integrations, and the living-system defaults that keep Sales,
          Composer, Gardens, Blooms, Roots, and Live coherent.
        </p>
      </div>

      {settingsGroups.map((group) => (
        <Section key={group.heading} heading={group.heading} blurb={group.blurb}>
          {group.cards.map((card) => (
            <SettingsCardView key={`${group.heading}-${card.title}`} card={card} />
          ))}
        </Section>
      ))}

      <section id="profile" className="scroll-mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-5">
        <h2 className="text-base font-semibold text-white">Profile</h2>
        <p className="mt-2 text-sm text-gray-400">
          Account profile editing lands next. For now, Sales outreach identity comes from the connected Gmail
          account, and facilitator presence is per Bloom / Live session.
        </p>
      </section>

      <section id="access" className="scroll-mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-5">
        <h2 className="text-base font-semibold text-white">Sign-in & access</h2>
        <p className="mt-2 text-sm text-gray-400">
          Admin auth stays on the existing gate. Multi-user roles and invite flows can live here when the workspace
          grows beyond a single operator.
        </p>
      </section>

      <section id="appearance" className="scroll-mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-5">
        <h2 className="text-base font-semibold text-white">Appearance</h2>
        <p className="mt-2 text-sm text-gray-400">
          Shell background is solid black. Use the sidebar Collapse control to switch between icon-only and labeled
          navigation; that preference is saved in this browser.
        </p>
      </section>

      <section id="danger" className="scroll-mt-8 rounded-xl border border-red-900/40 bg-[#0a0a0a] p-5">
        <h2 className="text-base font-semibold text-red-200">Danger zone</h2>
        <p className="mt-2 text-sm text-gray-400">
          Destructive actions (event submission wipes, garden deletes, Gmail disconnect) remain confirm-gated on their
          own pages so Settings never becomes a shortcut to irreversible ops.
        </p>
      </section>
    </div>
  );
}
