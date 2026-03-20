import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLayoutClient from "@/components/AdminLayoutClient";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  if (await hasRootAuthPasswordConfigured()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ROOT_AUTH_COOKIE_NAME)?.value;
    const expected = await getRootAuthExpectedToken();
    if (!token || !expected || token !== expected) {
      redirect("/");
    }
  }
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
