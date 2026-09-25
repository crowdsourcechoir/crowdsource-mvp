import { marketingDb } from "./client";
import { raiseDb } from "./errors";

export type EmailAssetRecord = {
  id: string;
  publicUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  contentType: string;
  byteSize: number;
  createdAt: string;
};

type AssetRow = {
  id: string;
  public_url: string;
  alt: string;
  width: number | null;
  height: number | null;
  content_type: string;
  byte_size: number;
  created_at: string;
};

function toAsset(row: AssetRow): EmailAssetRecord {
  return {
    id: row.id,
    publicUrl: row.public_url,
    alt: row.alt,
    width: row.width,
    height: row.height,
    contentType: row.content_type,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  };
}

export async function listEmailAssets(limit = 60): Promise<EmailAssetRecord[]> {
  const db = marketingDb();
  const { data, error } = await db
    .from("email_assets")
    .select("id, public_url, alt, width, height, content_type, byte_size, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  raiseDb(error);
  return ((data ?? []) as AssetRow[]).map(toAsset);
}

export async function insertEmailAsset(input: {
  bucket: string;
  path: string;
  publicUrl: string;
  alt: string;
  width: number | null;
  height: number | null;
  contentType: string;
  byteSize: number;
}): Promise<EmailAssetRecord> {
  const db = marketingDb();
  const { data, error } = await db
    .from("email_assets")
    .insert({
      bucket: input.bucket,
      path: input.path,
      public_url: input.publicUrl,
      alt: input.alt,
      width: input.width,
      height: input.height,
      content_type: input.contentType,
      byte_size: input.byteSize,
    })
    .select("id, public_url, alt, width, height, content_type, byte_size, created_at")
    .single();
  raiseDb(error);
  return toAsset(data as AssetRow);
}
