"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type AdminNavItem = {
  label: string;
  href: string;
  eyebrow: string;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
};

const NAV_COLLAPSE_KEY = "csc_admin_nav_collapsed";

function IconGardens({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-2.8 2.4-4.5 5.2-4.5 8.2A4.5 4.5 0 0 0 12 15.7a4.5 4.5 0 0 0 4.5-4.5C16.5 8.2 14.8 5.4 12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M12 15.7V21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 21h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconBlooms({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5c1.6 2.2 2.4 4.1 2.4 5.7A2.4 2.4 0 0 1 12 11.6 2.4 2.4 0 0 1 9.6 9.2C9.6 7.6 10.4 5.7 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M20.5 12c-2.2 1.6-4.1 2.4-5.7 2.4A2.4 2.4 0 0 1 12.4 12a2.4 2.4 0 0 1 2.4-2.4c1.6 0 3.5.8 5.7 2.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 20.5c-1.6-2.2-2.4-4.1-2.4-5.7A2.4 2.4 0 0 1 12 12.4a2.4 2.4 0 0 1 2.4 2.4c0 1.6-.8 3.5-2.4 5.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 12c2.2-1.6 4.1-2.4 5.7-2.4A2.4 2.4 0 0 1 11.6 12a2.4 2.4 0 0 1-2.4 2.4C7.6 14.4 5.7 13.6 3.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconRoots({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M12 11c-2.5 1.2-4 3.2-4.5 6M12 11c2.5 1.2 4 3.2 4.5 6M12 13.5c-1.4 1.8-1.8 3.6-1.8 5.5M12 13.5c1.4 1.8 1.8 3.6 1.8 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLive({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconComposer({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18V7.5l10-2V16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconSales({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7 15l3.2-3.5 2.6 2.2L17 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const navItems: AdminNavItem[] = [
  {
    label: "Gardens",
    eyebrow: "Persistent Worlds",
    href: "/admin/gardens",
    isActive: (pathname) => pathname.startsWith("/admin/gardens"),
    icon: <IconGardens className="h-5 w-5" />,
  },
  {
    label: "Blooms",
    eyebrow: "Live Events",
    href: "/admin/events",
    isActive: (pathname) => pathname.startsWith("/admin/events"),
    icon: <IconBlooms className="h-5 w-5" />,
  },
  {
    label: "Roots",
    eyebrow: "Root System",
    href: "/admin/roots",
    isActive: (pathname) =>
      pathname.startsWith("/admin/roots") ||
      pathname.startsWith("/admin/conductor") ||
      pathname.startsWith("/admin/resonance"),
    icon: <IconRoots className="h-5 w-5" />,
  },
  {
    label: "Live",
    eyebrow: "Runtime Tools",
    href: "/admin/live",
    isActive: (pathname) =>
      pathname.startsWith("/admin/live") || pathname.startsWith("/admin/live-prompt-game"),
    icon: <IconLive className="h-5 w-5" />,
  },
  {
    label: "Composer",
    eyebrow: "Musical Formation",
    href: "/admin/composer",
    isActive: (pathname) =>
      pathname.startsWith("/admin/composer") ||
      pathname.startsWith("/admin/canvas") ||
      pathname.startsWith("/admin/composition") ||
      pathname.startsWith("/admin/songgarden/"),
    icon: <IconComposer className="h-5 w-5" />,
  },
  {
    label: "Sales",
    eyebrow: "Prospecting Intelligence",
    href: "/admin/sales",
    isActive: (pathname) => pathname.startsWith("/admin/sales"),
    icon: <IconSales className="h-5 w-5" />,
  },
];

export default function AdminSideNav() {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAV_COLLAPSE_KEY);
      if (stored === "1" || stored === "0") {
        setCollapsed(stored === "1");
      } else {
        setCollapsed(window.matchMedia("(max-width: 767px)").matches);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NAV_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const settingsActive = pathname.startsWith("/admin/settings");

  return (
    <aside
      className={`relative sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-transparent bg-black transition-[width] duration-75 ease-out ${
        collapsed ? "w-[72px]" : "w-[232px]"
      } ${ready ? "opacity-100" : "opacity-0"}`}
      aria-label="Admin navigation"
    >
      <div className={`flex items-center gap-3 px-3 py-4 ${collapsed ? "justify-center" : "px-4"}`}>
        <Link href="/admin/gardens" className="flex min-w-0 items-center gap-3" title="Crowdsource Choir">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crowdsource Choir" className="h-8 w-auto shrink-0" />
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-wide text-white">Crowdsource</span>
          )}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 pb-3">
        {navItems.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? `${item.label} — ${item.eyebrow}` : item.eyebrow}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className={`shrink-0 ${active ? "text-[#CFFF81]" : "text-gray-400 group-hover:text-white"}`}>
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 px-2 py-3">
        <Link
          href="/admin/settings"
          title={collapsed ? "Settings" : undefined}
          aria-current={settingsActive ? "page" : undefined}
          className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
            collapsed ? "justify-center" : ""
          } ${
            settingsActive
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className={`shrink-0 ${settingsActive ? "text-[#CFFF81]" : "text-gray-400 group-hover:text-white"}`}>
            <IconSettings className="h-5 w-5" />
          </span>
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>

      {/* Full-height border hit target — no static arrow */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title="Toggle Sidebar"
        aria-label="Toggle Sidebar"
        aria-expanded={!collapsed}
        className="group/rail absolute inset-y-0 right-0 z-20 w-3 translate-x-1/2 cursor-col-resize border-0 bg-transparent p-0"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition-colors duration-75 group-hover/rail:bg-[#CFFF81]/70 group-focus-visible/rail:bg-[#CFFF81]"
        />
      </button>
    </aside>
  );
}
