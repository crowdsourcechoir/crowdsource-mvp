import { NextResponse } from "next/server";
import { hasRootAuthPasswordConfigured } from "@/lib/root-page-auth";
import { homePath, navAccess } from "@/lib/operators/access";
import { readActorFromCookies } from "@/lib/operators/current";

export async function GET() {
  if (!(await hasRootAuthPasswordConfigured())) {
    return NextResponse.json({
      ok: true,
      role: "owner",
      home: "/admin/gardens",
      nav: { gardens: true, blooms: true, composer: true, sales: true, marketing: true, live: true, settings: true },
    });
  }
  const actor = await readActorFromCookies();
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    role: actor.role,
    name: actor.name,
    email: actor.email,
    home: homePath(actor),
    nav: actor.legacy
      ? { gardens: true, blooms: true, composer: true, sales: true, marketing: true, live: true, settings: true }
      : navAccess(actor),
    legacy: actor.legacy,
  });
}
