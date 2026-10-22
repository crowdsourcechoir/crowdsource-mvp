import { NextResponse } from "next/server";
import { withMarketingAuth } from "@/lib/marketing/auth";
import { EMAIL_ASSET_MAX_BYTES, emailAssetExtension, newEmailAssetPath } from "@/lib/marketing/assets/policy";
import { createEmailAssetSignedUpload } from "@/lib/marketing/assets/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMarketingAuth(async () => {
    const body = (await request.json().catch(() => null)) as { contentType?: unknown; byteSize?: unknown } | null;
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const ext = emailAssetExtension(contentType);
    if (!ext) {
      return NextResponse.json({ error: "Use a JPEG, PNG, GIF, or WebP image." }, { status: 400 });
    }
    const byteSize = typeof body?.byteSize === "number" ? body.byteSize : 0;
    if (byteSize <= 0 || byteSize > EMAIL_ASSET_MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
    }
    const upload = await createEmailAssetSignedUpload(newEmailAssetPath(ext));
    return NextResponse.json({ ...upload, maxBytes: EMAIL_ASSET_MAX_BYTES });
  });
}
