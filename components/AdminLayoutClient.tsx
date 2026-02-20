"use client";

import { usePathname } from "next/navigation";
import AdminShell from "./AdminShell";

type AdminLayoutClientProps = {
  children: React.ReactNode;
};

function titleFromPath(pathname: string): string {
  if (pathname === "/admin/events") return "";
  if (pathname === "/admin/events/new") return "";
  if (pathname.startsWith("/admin/conductor/")) return "";
  if (pathname.includes("/edit")) return "";
  if (/^\/admin\/events\/[^/]+$/.test(pathname)) return "";
  return "Admin";
}

export default function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const title = titleFromPath(pathname ?? "");
  return <AdminShell title={title}>{children}</AdminShell>;
}
