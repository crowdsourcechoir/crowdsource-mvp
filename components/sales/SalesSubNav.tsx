"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/sales/queue", label: "Queue" },
  { href: "/admin/sales/organizations", label: "Organizations" },
  { href: "/admin/sales/funnel", label: "Funnel" },
];

/** Cross-links between the sales sub-pages, so getting from e.g. the queue to the funnel doesn't
 * require going back through /admin/sales first — same idea as TopBar's top-level nav, scoped one
 * level down. */
export default function SalesSubNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Sales sections">
      {LINKS.map((link) => {
        const active = pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
