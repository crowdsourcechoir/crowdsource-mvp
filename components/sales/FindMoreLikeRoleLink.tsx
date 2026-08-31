"use client";

import Link from "next/link";
import { findMoreLikeRoleHref } from "@/lib/sales/find-leads";

export default function FindMoreLikeRoleLink({
  orgId,
  role,
  className = "mt-1 inline-block text-xs text-sky-500/80 underline",
}: {
  orgId: string;
  role: string;
  className?: string;
}) {
  const trimmed = role.trim();
  if (!trimmed) return null;
  return (
    <Link href={findMoreLikeRoleHref(orgId, trimmed)} className={className} onClick={(e) => e.stopPropagation()}>
      Find more like this role
    </Link>
  );
}
