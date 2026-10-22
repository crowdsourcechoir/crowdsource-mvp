import AdminLayoutClient from "@/components/AdminLayoutClient";
import { hasRootAuthPasswordConfigured } from "@/lib/root-page-auth";
import { readActorFromCookies } from "@/lib/operators/current";
import { redirect } from "next/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  if (await hasRootAuthPasswordConfigured()) {
    const actor = await readActorFromCookies();
    if (!actor) redirect("/");
  }
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
