import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { EMAIL_ASSET_MAX_BYTES, emailAssetExtension, isLibraryAssetPath } from "@/lib/marketing/assets/policy";
import { EMAIL_ASSETS_BUCKET, emailAssetPublicUrl, verifyEmailAssetObject } from "@/lib/marketing/assets/storage";
import { insertEmailAsset } from "@/lib/marketing/db/assets";

export const dynamic = "force-dynamic";

function optionalDimension(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 20000) return null;
  return Math.round(value);
}

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const path = typeof body?.path === "string" ? body.path : "";
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const byteSize = typeof body?.byteSize === "number" ? body.byteSize : 0;
    const alt = typeof body?.alt === "string" ? body.alt.trim().slice(0, 200) : "";
    if (!isLibraryAssetPath(path) || !emailAssetExtension(contentType)) {
      return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
    }
    if (byteSize <= 0 || byteSize > EMAIL_ASSET_MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
    }
    const exists = await verifyEmailAssetObject(path);
    if (!exists) return NextResponse.json({ error: "Upload did not finish." }, { status: 400 });
    const asset = await insertEmailAsset({
      bucket: EMAIL_ASSETS_BUCKET,
      path,
      publicUrl: emailAssetPublicUrl(path),
      alt,
      width: optionalDimension(body?.width),
      height: optionalDimension(body?.height),
      contentType,
      byteSize,
    });
    return NextResponse.json({ asset });
  });
}
