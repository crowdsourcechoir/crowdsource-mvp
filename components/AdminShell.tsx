"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminSideNav from "./AdminSideNav";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
};

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 8h14M5 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname() ?? "";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-black text-gray-100">
      <AdminSideNav mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-black">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-black/95 px-3 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            className="csc-btn-circle shrink-0"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="admin-side-nav"
            onClick={() => setMobileNavOpen(true)}
          >
            <IconMenu className="h-4 w-4" />
          </button>
          <span className="truncate text-sm font-medium text-gray-300">Crowdsource Choir</span>
        </div>
        <div className="w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
