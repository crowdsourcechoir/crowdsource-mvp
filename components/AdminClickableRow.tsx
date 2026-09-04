import Link from "next/link";
import type { ReactNode } from "react";

/** Shared surface for admin list rows (Blooms, Composer). Nested controls need `relative z-10`. */
export const ADMIN_CLICKABLE_ROW_SURFACE =
  "group relative rounded-2xl border border-white/10 bg-[#121212] px-4 py-3 transition-colors hover:border-white/50";

/** Raise nested buttons/links above the row hit target. */
export const ADMIN_ROW_ACTION = "relative z-10";

type AdminClickableRowProps = {
  href: string;
  ariaLabel: string;
  children: ReactNode;
};

export default function AdminClickableRow({ href, ariaLabel, children }: AdminClickableRowProps) {
  return (
    <article className={ADMIN_CLICKABLE_ROW_SURFACE}>
      {children}
      <Link href={href} className="absolute inset-0 z-0 rounded-2xl" aria-label={ariaLabel} />
    </article>
  );
}
