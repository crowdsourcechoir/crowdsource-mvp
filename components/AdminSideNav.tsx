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

function IconMarketing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 12v8M4 8.5l8 3.5 8-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  // OCTO — matches the octopus mark reference (mask so active tint inherits currentColor)
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/icons/octopus-settings.svg)",
        maskImage: "url(/icons/octopus-settings.svg)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type NavFlags = {
  gardens: boolean;
  blooms: boolean;
  live: boolean;
  composer: boolean;
  sales: boolean;
  marketing: boolean;
  settings: boolean;
};

const OPEN_NAV: NavFlags = {
  gardens: true,
  blooms: true,
  live: true,
  composer: true,
  sales: true,
  marketing: true,
  settings: true,
};

const navItems: Array<AdminNavItem & { key: keyof NavFlags }> = [
  {
    label: "Gardens",
    key: "gardens",
    eyebrow: "Persistent Worlds",
    href: "/admin/gardens",
    isActive: (pathname) => pathname.startsWith("/admin/gardens"),
    icon: <IconGardens className="h-5 w-5" />,
  },
  {
    label: "Blooms",
    key: "blooms",
    eyebrow: "Live Events",
    href: "/admin/events",
    isActive: (pathname) => pathname.startsWith("/admin/events"),
    icon: <IconBlooms className="h-5 w-5" />,
  },
  {
    label: "Live",
    key: "live",
    eyebrow: "Runtime Tools",
    href: "/admin/live",
    isActive: (pathname) =>
      pathname.startsWith("/admin/live") ||
      pathname.startsWith("/admin/live-prompt-game") ||
      pathname.startsWith("/admin/shows"),
    icon: <IconLive className="h-5 w-5" />,
  },
  {
    label: "Composer",
    key: "composer",
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
    key: "sales",
    eyebrow: "Prospecting Intelligence",
    href: "/admin/sales",
    isActive: (pathname) => pathname.startsWith("/admin/sales"),
    icon: <IconSales className="h-5 w-5" />,
  },
  {
    label: "Marketing",
    key: "marketing",
    eyebrow: "Audience & Campaigns",
    href: "/admin/marketing",
    isActive: (pathname) => pathname.startsWith("/admin/marketing"),
    icon: <IconMarketing className="h-5 w-5" />,
  },
];

type AdminSideNavProps = {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

export default function AdminSideNav({
  mobileOpen = false,
  onMobileOpenChange,
}: AdminSideNavProps) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [nav, setNav] = useState<NavFlags>(OPEN_NAV);
  const [home, setHome] = useState("/admin/gardens");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NAV_COLLAPSE_KEY);
      if (stored === "1" || stored === "0") {
        setCollapsed(stored === "1");
      } else {
        // Desktop-only preference; mobile uses the off-canvas drawer instead.
        setCollapsed(false);
      }
    } catch {
      /* ignore */
    }
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.nav) setNav(data.nav);
        if (typeof data?.home === "string") setHome(data.home);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
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

  function closeMobile() {
    onMobileOpenChange?.(false);
  }

  const settingsActive =
    pathname.startsWith("/admin/settings") ||
    pathname.startsWith("/admin/roots") ||
    pathname.startsWith("/admin/resonance");

  // Mobile drawer always shows labels when open; desktop keeps the collapse rail.
  const showLabels = mobileOpen || !collapsed;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          aria-label="Dismiss navigation"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        id="admin-side-nav"
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[232px] max-w-[80vw] shrink-0 flex-col overflow-hidden border-r border-transparent bg-black transition-transform duration-200 ease-out md:relative md:visible md:z-auto md:max-w-none md:translate-x-0 md:pointer-events-auto ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full max-md:pointer-events-none max-md:invisible"
        } ${collapsed ? "md:w-[72px]" : "md:w-[232px]"} ${ready ? "opacity-100" : "opacity-0"}`}
        aria-label="Admin navigation"
      >
        <div className={`flex items-center px-3 py-4 ${showLabels ? "justify-between gap-2 px-4" : "justify-center"}`}>
          <Link href={home} className="flex min-w-0 shrink items-center" title="Crowdsource Choir" onClick={closeMobile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crowdsource Choir" className="h-8 w-auto shrink-0" />
          </Link>
          <button
            type="button"
            className="csc-btn-circle shrink-0 md:hidden"
            aria-label="Close navigation"
            onClick={closeMobile}
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
          {navItems.filter((item) => nav[item.key]).map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={showLabels ? item.eyebrow : `${item.label} — ${item.eyebrow}`}
                aria-current={active ? "page" : undefined}
                onClick={closeMobile}
                className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
                  showLabels ? "" : "justify-center"
                } ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={`shrink-0 ${active ? "text-[#CFFF81]" : "text-gray-400 group-hover:text-white"}`}>
                  {item.icon}
                </span>
                {showLabels && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 px-2 py-3">
          {nav.settings ? (
            <Link
              href="/admin/settings"
              title={showLabels ? undefined : "Settings"}
              aria-current={settingsActive ? "page" : undefined}
              onClick={closeMobile}
              className={`group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
                showLabels ? "" : "justify-center"
              } ${
                settingsActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className={`shrink-0 ${settingsActive ? "text-[var(--csc-accent)]" : "text-gray-400 group-hover:text-white"}`}>
                <IconSettings className="h-5 w-5" />
              </span>
              {showLabels && <span>Settings</span>}
            </Link>
          ) : null}
          <button
            type="button"
            className={`mt-1 w-full rounded-lg px-2.5 py-2 text-left text-xs text-gray-500 hover:text-white ${showLabels ? "" : "text-center"}`}
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/";
              });
            }}
          >
            {showLabels ? "Sign out" : "Out"}
          </button>
        </div>

        {/* Full-height border hit target — desktop collapse only */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Toggle Sidebar"
          aria-label="Toggle Sidebar"
          aria-expanded={!collapsed}
          className="group/rail absolute inset-y-0 right-0 z-20 hidden w-3 translate-x-1/2 cursor-col-resize border-0 bg-transparent p-0 md:block"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition-colors duration-75 group-hover/rail:bg-[#CFFF81]/70 group-focus-visible/rail:bg-[#CFFF81]"
          />
        </button>
      </aside>
    </>
  );
}
