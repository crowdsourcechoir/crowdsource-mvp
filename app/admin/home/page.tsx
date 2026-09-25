"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Nav = {
  gardens: boolean;
  blooms: boolean;
  composer: boolean;
  sales: boolean;
  settings: boolean;
};

const LINKS: Array<{ key: keyof Nav; href: string; label: string; detail: string }> = [
  { key: "gardens", href: "/admin/gardens", label: "Gardens", detail: "Song Gardens you steward" },
  { key: "blooms", href: "/admin/events", label: "Blooms", detail: "Blooms you steward" },
  { key: "composer", href: "/admin/composer", label: "Composer", detail: "Creative material you can shape" },
  { key: "sales", href: "/admin/sales", label: "Sales", detail: "Pipeline and drafts" },
  { key: "settings", href: "/admin/settings", label: "Settings", detail: "People, integrations, design system" },
];

export default function AdminHomePage() {
  const [nav, setNav] = useState<Nav | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setNav(data?.nav ?? null))
      .catch(() => setNav(null));
  }, []);

  const visible = LINKS.filter((link) => nav?.[link.key]);

  return (
    <div className="space-y-6 text-white">
      <div>
        <p className="csc-eyebrow">Your rooms</p>
        <h1 className="mt-2 text-2xl font-bold">Welcome</h1>
      </div>
      <div className="csc-list">
        {visible.map((link) => (
          <Link key={link.href} href={link.href} className="csc-list-row">
            <span>
              <span className="block text-sm font-medium text-white">{link.label}</span>
              <span className="block text-xs text-gray-400">{link.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
