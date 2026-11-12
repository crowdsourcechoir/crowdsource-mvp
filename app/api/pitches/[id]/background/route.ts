import { NextResponse } from "next/server";
import { signedInOwner } from "@/lib/operators/current";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

type RouteContext = { params: { id: string } };

function isVideoType(contentType: string): boolean {
  return contentType === "video/mp4" || contentType === "video/webm" || contentType === "video/quicktime";
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function extFor(name: string, contentType: string): string {
  const fromName = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName === "mov") return "mov";
  if (fromName) return fromName;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mp4")) return "mp4";
  return "jpg";
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!(await signedInOwner())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!/^[a-z0-9_-]{1,80}$/.test(params.id)) {
    return NextResponse.json({ error: "That pitch was not found." }, { status: 404 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slideId?: string;
    name?: string;
    contentType?: string;
    size?: number;
    kind?: string;
  };
  const rawType = typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
  const kind =
    body.kind === "video" || isVideoType(rawType)
      ? "video"
      : body.kind === "image" || isImageType(rawType) || !rawType
        ? "image"
        : null;
  if (!kind) {
    return NextResponse.json({ error: "Upload a photo or an mp4/webm video." }, { status: 400 });
  }

  const contentType =
    kind === "video"
      ? isVideoType(rawType)
        ? rawType
        : "video/mp4"
      : isImageType(rawType)
        ? rawType
        : "image/jpeg";

  const size = Number(body.size) || 0;
  const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size <= 0 || size > maxBytes) {
    return NextResponse.json(
      { error: kind === "video" ? "Video must be under 40MB." : "Photo must be under 20MB." },
      { status: 400 }
    );
  }

  const slideId = (body.slideId || "section").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "section";
  const pitchId = params.id.replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  const path = `pitch-decks/${pitchId}/${slideId}-${Date.now()}.${extFor(body.name || "", contentType)}`;

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Could not prepare upload." }, { status: 500 });
  }
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    upload: { signedUrl: data.signedUrl, publicUrl: pub.publicUrl, contentType, kind },
  });
}
