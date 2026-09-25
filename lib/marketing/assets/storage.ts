import { supabaseAdmin } from "@/lib/supabase-server";
import { isLibraryAssetPath } from "./policy";

export const EMAIL_ASSETS_BUCKET = "email-assets";

let bucketChecked = false;

export async function ensureEmailAssetsBucket(): Promise<void> {
  if (!supabaseAdmin || bucketChecked) return;
  bucketChecked = true;
  const { data: existing, error } = await supabaseAdmin.storage.listBuckets();
  if (error) return;
  const bucket = existing?.find((item) => item.name === EMAIL_ASSETS_BUCKET);
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(EMAIL_ASSETS_BUCKET, { public: true });
    return;
  }
  if (!bucket.public) {
    await supabaseAdmin.storage.updateBucket(EMAIL_ASSETS_BUCKET, { public: true });
  }
}

export function emailAssetPublicUrl(path: string): string {
  if (!supabaseAdmin) return "";
  const { data } = supabaseAdmin.storage.from(EMAIL_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createEmailAssetSignedUpload(path: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}> {
  if (!supabaseAdmin) throw new Error("Storage not configured.");
  if (!isLibraryAssetPath(path)) throw new Error("Invalid asset path.");
  await ensureEmailAssetsBucket();
  const { data, error } = await supabaseAdmin.storage.from(EMAIL_ASSETS_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new Error(error?.message || "Could not create signed upload URL.");
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: emailAssetPublicUrl(data.path),
  };
}

export async function verifyEmailAssetObject(path: string): Promise<boolean> {
  if (!supabaseAdmin || !isLibraryAssetPath(path)) return false;
  const name = path.slice("library/".length);
  const { data, error } = await supabaseAdmin.storage.from(EMAIL_ASSETS_BUCKET).list("library", {
    search: name,
    limit: 10,
  });
  if (error || !data?.length) return false;
  return data.some((file) => file.name === name);
}
