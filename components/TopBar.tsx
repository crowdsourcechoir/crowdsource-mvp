"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TopBarProps = {
  title: string;
};

export default function TopBar({ title }: TopBarProps) {
  const pathname = usePathname();
  const activeEvents =
    pathname?.startsWith("/admin/events") ||
    pathname?.startsWith("/admin/conductor") ||
    pathname?.startsWith("/admin/gardens");
  const activeLive = pathname?.startsWith("/admin/live") || pathname?.startsWith("/admin/live-prompt-game");
  const activeSales = pathname?.startsWith("/admin/sales");

  return (
    <header className="sticky top-0 z-10 flex min-h-[3.5rem] w-full items-center justify-between border-b border-gray-800 bg-[#0c0c0e] px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        {title ? (
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
        ) : (
          <Link href="/admin/live" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crowdsource Choir" className="h-8 w-auto" />
          </Link>
        )}

        <nav className="flex items-center gap-2" aria-label="Admin sections">
          <Link
            href="/admin/live"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeLive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            Live
          </Link>
          <Link
            href="/admin/events"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeEvents && !pathname?.startsWith("/admin/gardens")
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            Events
          </Link>
          <Link
            href="/admin/gardens"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname?.startsWith("/admin/gardens")
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            Gardens
          </Link>
          <Link
            href="/admin/sales"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeSales ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            Sales
          </Link>
        </nav>
      </div>
    </header>
  );
}
