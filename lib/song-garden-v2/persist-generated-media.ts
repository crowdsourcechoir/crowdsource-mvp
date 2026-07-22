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

  if (supabaseAdmin) {
    await ensureBucket();
    const filePath = `storyboards/${filename}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, bytes, { contentType, upsert: true });
    if (uploadErr) throw new Error(`Failed to upload generated media: ${uploadErr.message}`);
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  }

  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const localPath = path.join(LOCAL_DIR, filename);
  await fs.writeFile(localPath, bytes);
  return `/song-garden-v2/world-scenes/generated/${filename}`;
}
