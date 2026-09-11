import { appendFile, mkdir } from "fs/promises";
import { NextResponse } from "next/server";

/** Temporary debug ingest for PhotoMomentPad stall investigation. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await mkdir("/opt/cursor/logs", { recursive: true });
    await appendFile(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({ ...body, timestamp: body.timestamp ?? Date.now() })}\n`
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
