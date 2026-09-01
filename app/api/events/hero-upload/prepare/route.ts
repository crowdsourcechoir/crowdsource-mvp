import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
/** Allow large venue photos; Vercel body limit is bypassed via signed upload. */
const MAX_BYTES = 20 * 1024 * 1024;

let bucketChecked = false;

async function ensureBucket() {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
  if (error) return;
  if (!existing?.some((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  }
}

function extFor(name: string, contentType: string): string {
  const fromName = /\.(jpe?g|png|webp|gif|heic|heif|avif|svg)$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName) return fromName;
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Prepare a direct-to-storage hero upload (bypasses Vercel ~4.5MB body limit).
 * Client PUTs the file to signedUrl, then saves the publicUrl as event.heroImage.
 */
export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Storage not configured.", code: "not_configured" },
        { status: 503, ...NO_STORE }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      contentType?: string;
      size?: number;
      eventId?: string;
      /** `logo` stores under a -logo- path for bloom client marks. */
      purpose?: "hero" | "logo";
    };

    const size = Number(body.size) || 0;
    if (size <= 0 || size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Hero image must be under 20MB (got ${Math.round(size / (1024 * 1024))}MB).`,
        },
        { status: 400, ...NO_STORE }
      );
    }

    const contentType =
      typeof body.contentType === "string" &&
      (body.contentType.startsWith("image/") || body.contentType === "image/svg+xml")
        ? body.contentType
        : "image/jpeg";
    const ext = extFor(body.name || "", contentType);
    const eventKey =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
        : `tmp-${Date.now().toString(36)}`;
    const purpose = body.purpose === "logo" ? "logo" : "hero";
    const path = `heroes/${eventKey}-${purpose}-${Date.now()}.${ext}`;

    await ensureBucket();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data) {
      throw new Error(error?.message || "Could not create signed upload URL.");
    }

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json(
      {
        upload: {
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: pub.publicUrl,
          contentType,
        },
        maxBytes: MAX_BYTES,
      },
      NO_STORE
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
