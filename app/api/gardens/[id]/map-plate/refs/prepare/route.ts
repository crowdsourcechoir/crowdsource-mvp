import { NextResponse } from "next/server";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 8;

type Ctx = { params: { id: string } };

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
  const fromName = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName) return fromName;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Prepare direct-to-storage uploads (bypasses Vercel ~4.5MB body limit).
 * Client PUTs each file to signedUrl, then POSTs publicUrls to /map-plate/refs.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: "Storage not configured.",
          code: "not_configured",
        },
        { status: 503, ...NO_STORE }
      );
    }

    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    const body = (await request.json()) as {
      files?: Array<{ name?: string; contentType?: string; size?: number }>;
    };
    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      return NextResponse.json({ error: "No files listed." }, { status: 400, ...NO_STORE });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Max ${MAX_FILES} files per upload.` },
        { status: 400, ...NO_STORE }
      );
    }

    const room = Math.max(0, MAX_FILES - garden.brandKit.mapPlate.referenceUrls.length);
    if (room === 0) {
      return NextResponse.json(
        { error: `Already at ${MAX_FILES} references. Remove one first.` },
        { status: 400, ...NO_STORE }
      );
    }

    await ensureBucket();

    const uploads: Array<{
      signedUrl: string;
      token: string;
      path: string;
      publicUrl: string;
      contentType: string;
    }> = [];

    for (const file of files.slice(0, room)) {
      const size = Number(file.size) || 0;
      if (size <= 0 || size > MAX_BYTES) {
        return NextResponse.json(
          {
            error: `“${file.name || "Image"}” must be under 20MB (got ${Math.round(size / (1024 * 1024))}MB).`,
          },
          { status: 400, ...NO_STORE }
        );
      }
      const contentType =
        typeof file.contentType === "string" && file.contentType.startsWith("image/")
          ? file.contentType
          : "image/jpeg";
      const ext = extFor(file.name || "", contentType);
      const path = `heroes/garden-${garden.id}-map-ref-${Date.now()}-${uploads.length}.${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path, { upsert: true });
      if (error || !data) {
        throw new Error(error?.message || "Could not create signed upload URL.");
      }

      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
      uploads.push({
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        publicUrl: pub.publicUrl,
        contentType,
      });
    }

    return NextResponse.json({ uploads, maxBytes: MAX_BYTES }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
