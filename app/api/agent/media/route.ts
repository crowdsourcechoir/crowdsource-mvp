import { NextResponse } from "next/server";
import {
  downloadAgentMediaObject,
  ensureAgentMediaBucket,
  guessAgentMediaContentType,
} from "@/lib/agent-media/storage-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRange(
  header: string | null,
  size: number
): { start: number; end: number } | null {
  if (!header || !header.startsWith("bytes=")) return null;
  const [startRaw, endRaw] = header.slice(6).split("-", 2);
  const start = Number(startRaw);
  const end = endRaw ? Number(endRaw) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Stream conversation media (audio / video / photo) via the service role so
 * Composer cards work even when the agent-media bucket is private.
 *
 * GET /api/agent/media?path=conversations%2F...%2Fvideo-....webm
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = (searchParams.get("path") || "").trim();
  if (!path || !path.startsWith("conversations/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }

  try {
    await ensureAgentMediaBucket();
    const downloaded = await downloadAgentMediaObject(path);
    if (!downloaded) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const contentType = downloaded.contentType || guessAgentMediaContentType(path);
    const total = downloaded.buffer.length;
    const range = parseRange(request.headers.get("range"), total);
    const filename = path.split("/").pop() || "media";

    if (range) {
      const slice = downloaded.buffer.subarray(range.start, range.end + 1);
      return new NextResponse(new Uint8Array(slice), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(slice.length),
          "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    return new NextResponse(new Uint8Array(downloaded.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("agent media GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
