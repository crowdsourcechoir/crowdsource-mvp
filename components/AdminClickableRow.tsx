"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

/** Shared surface for admin list rows (Blooms, Composer). Nested controls need `ADMIN_ROW_ACTION`. */
export const ADMIN_CLICKABLE_ROW_SURFACE =
  "group relative cursor-pointer rounded-2xl border border-white/10 bg-[#121212] px-4 py-3 transition-colors hover:border-white/50";

/** Nested buttons/links keep their own clicks. */
export const ADMIN_ROW_ACTION = "relative z-10";

type AdminClickableRowProps = {
  href: string;
  ariaLabel: string;
  children: ReactNode;
};

function isNestedControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, textarea, select, [role='button']"));
}

export default function AdminClickableRow({ href, ariaLabel, children }: AdminClickableRowProps) {
  const router = useRouter();

  function go(newTab = false) {
    if (newTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  function onClick(e: MouseEvent<HTMLElement>) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (isNestedControl(e.target)) return;
    e.preventDefault();
    go(e.metaKey || e.ctrlKey);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (isNestedControl(e.target)) return;
    e.preventDefault();
    go();
  }

  return (
    <article
      className={ADMIN_CLICKABLE_ROW_SURFACE}
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </article>
  );
}
