import { NextResponse } from "next/server";
import { deleteGmailConnection } from "@/lib/sales/db/gmail";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await deleteGmailConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
