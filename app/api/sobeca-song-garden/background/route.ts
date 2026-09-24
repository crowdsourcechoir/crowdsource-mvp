import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  ROOT_AUTH_COOKIE_NAME,
  getRootAuthExpectedToken,
  hasRootAuthPasswordConfigured,
} from "@/lib/root-page-auth";

export const dynamic = "force-dynamic";

const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
const MAX_BYTES = 20 * 1024 * 1024;

async function allowed(): Promise<boolean> {
  if (!(await hasRootAuthPasswordConfigured())) return true;
  const token = (await cookies()).get(ROOT_AUTH_COOKIE_NAME)?.value;
  const expected = await getRootAuthExpectedToken();
  return Boolean(token && expected && token === expected);
}

function extFor(name: string, contentType: string): string {
  const fromName = /\.(jpe?g|png|webp|gif)$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName) return fromName;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  if (!(await allowed())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    slideId?: string;
    name?: string;
    contentType?: string;
    size?: number;
  };
  const size = Number(body.size) || 0;
  if (size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo must be under 20MB." }, { status: 400 });
  }
  const contentType =
    typeof body.contentType === "string" && body.contentType.startsWith("image/") ? body.contentType : "image/jpeg";
  const slideId = (body.slideId || "section").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "section";
  const path = `sobeca-pitch/${slideId}-${Date.now()}.${extFor(body.name || "", contentType)}`;

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Could not prepare upload." }, { status: 500 });
  }
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    upload: { signedUrl: data.signedUrl, publicUrl: pub.publicUrl, contentType },
  });
}
