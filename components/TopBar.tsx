"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopBarProps = {
  title: string;
};

type AdminNavItem = {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

const navItems: AdminNavItem[] = [
  {
    label: "Gardens",
    href: "/admin/gardens",
    isActive: (pathname) => pathname.startsWith("/admin/gardens"),
  },
  {
    label: "Blooms",
    href: "/admin/events",
    isActive: (pathname) => pathname.startsWith("/admin/events"),
  },
  {
    label: "Roots",
    href: "/admin/roots",
    isActive: (pathname) =>
      pathname.startsWith("/admin/roots") ||
      pathname.startsWith("/admin/conductor") ||
      pathname.startsWith("/admin/resonance"),
  },
  {
    label: "Live",
    href: "/admin/live",
    isActive: (pathname) =>
      pathname.startsWith("/admin/live") || pathname.startsWith("/admin/live-prompt-game"),
  },
  {
    label: "Canvas",
    href: "/admin/canvas",
    isActive: (pathname) =>
      pathname.startsWith("/admin/canvas") ||
      pathname.startsWith("/admin/composition") ||
      pathname.startsWith("/admin/songgarden/"),
  },
  {
    label: "Sales",
    href: "/admin/sales",
    isActive: (pathname) => pathname.startsWith("/admin/sales"),
  },
];

export default function TopBar({ title }: TopBarProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  return (
    <header className="sticky top-0 z-10 flex min-h-[3.5rem] w-full items-center justify-between border-b border-gray-800 bg-[#0c0c0e] px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        {title ? (
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
        ) : (
          <Link href="/admin/gardens" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crowdsource Choir" className="h-8 w-auto" />
          </Link>
        )}

        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto" aria-label="Admin sections">
          {navItems.map((item) => {
            const active = item.isActive(currentPath);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
