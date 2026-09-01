import { NextResponse } from "next/server";
import { loadTodayPage } from "@/lib/sales/db/today";
import { publicErrorMessage } from "@/lib/sales/http-error";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const data = await loadTodayPage();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, "Failed to load today") }, { status: 500 });
  }
}
