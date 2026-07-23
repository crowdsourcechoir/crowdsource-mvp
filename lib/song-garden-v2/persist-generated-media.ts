import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = process.env.SONG_GARDEN_MEDIA_BUCKET || "song-garden-world-media";
const LOCAL_DIR = path.join(process.cwd(), "public", "song-garden-v2", "world-scenes", "generated");

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

async function uploadBytes(
  bytes: Buffer,
  filePath: string,
  contentType: string,
  localSubdir: "generated" | "heroes"
): Promise<string> {
  if (supabaseAdmin) {
    await ensureBucket();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, bytes, { contentType, upsert: true });
    if (uploadErr) throw new Error(`Failed to upload generated media: ${uploadErr.message}`);
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  }

  const dir =
    localSubdir === "heroes"
      ? path.join(process.cwd(), "public", "song-garden-v2", "heroes")
      : LOCAL_DIR;
  await fs.mkdir(dir, { recursive: true });
  const filename = path.basename(filePath);
  await fs.writeFile(path.join(dir, filename), bytes);
  return localSubdir === "heroes"
    ? `/song-garden-v2/heroes/${filename}`
    : `/song-garden-v2/world-scenes/generated/${filename}`;
}

/**
 * Runway's generated output URLs expire in 24-48h, so anything we want to keep in
 * worldConfig.worldStoryboard long-term needs to be re-hosted first. Uploads to Supabase
 * Storage when configured (production), otherwise writes straight into public/ for local dev
 * without Supabase set up.
 */
export async function persistGeneratedMedia(
  sourceUrl: string,
  filename: string,
  contentType: string
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to download generated media (${res.status}).`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return uploadBytes(bytes, `storyboards/${filename}`, contentType, "generated");
}

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;

/**
 * Persist an inline data-URI image (e.g. event hero uploads) to storage and return a
 * stable public URL. Pass-through for http(s) URLs and relative paths.
 */
export async function persistDataUrlMedia(
  dataUrl: string,
  filenameBase: string
): Promise<string> {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return dataUrl;
  const contentType = match[1] || "image/png";
  const bytes = Buffer.from(match[2], "base64");
  const ext =
    contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "png";
  const filename = filenameBase.endsWith(`.${ext}`) ? filenameBase : `${filenameBase}.${ext}`;
  return uploadBytes(bytes, `heroes/${filename}`, contentType, "heroes");
}

/** If value is a data-URI image, host it; otherwise return as-is. */
export async function resolveHeroImageForStorage(
  heroImage: string | null | undefined,
  eventId: string
): Promise<string | undefined> {
  if (heroImage == null) return undefined;
  if (typeof heroImage !== "string") return undefined;
  if (!heroImage.startsWith("data:image/")) return heroImage;
  return persistDataUrlMedia(heroImage, `${eventId}-hero`);
}
