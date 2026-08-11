import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, updateGarden } from "@/lib/song-garden-v2/garden/store";
import { persistDataUrlMedia } from "@/lib/song-garden-v2/persist-generated-media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const MAX_FILES = 8;
/** Soft cap for legacy data-URL / multipart path (prefer signed upload via /refs/prepare). */
const MAX_BYTES = 20 * 1024 * 1024;

type Ctx = { params: { id: string } };

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
const HTTPS_URL_RE = /^https:\/\/.+/i;

function extFor(contentType: string, fallbackName = ""): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("heic") || contentType.includes("heif")) return "heic";
  if (contentType.includes("avif")) return "avif";
  const fromName = IMAGE_EXT_RE.exec(fallbackName)?.[1]?.toLowerCase();
  if (fromName === "jpeg") return "jpg";
  if (fromName) return fromName;
  return "png";
}

function isImageBlob(blob: Blob, name = ""): boolean {
  if (blob.type.startsWith("image/")) return true;
  if (!blob.type && IMAGE_EXT_RE.test(name)) return true;
  return false;
}

function isAllowedPublicUrl(url: string): boolean {
  if (!HTTPS_URL_RE.test(url)) return false;
  try {
    const u = new URL(url);
    return IMAGE_EXT_RE.test(u.pathname) || u.pathname.includes("/object/public/");
  } catch {
    return false;
  }
}

async function blobToDataUrl(blob: Blob, name = ""): Promise<string> {
  if (blob.size > MAX_BYTES) {
    throw new Error(`“${name || "Image"}” is too large (max 20MB).`);
  }
  if (!isImageBlob(blob, name)) {
    throw new Error(`“${name || "File"}” is not an image.`);
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  const contentType =
    blob.type && blob.type.startsWith("image/")
      ? blob.type
      : `image/${extFor("", name) === "jpg" ? "jpeg" : extFor("", name) || "jpeg"}`;
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

/**
 * Register map-plate reference photos.
 *
 * Preferred (large files up to 20MB): JSON `{ urls: string[], append? }` after
 * uploading via `POST .../map-plate/refs/prepare` + PUT to the signed URL.
 *
 * Legacy (small files): multipart FormData or JSON `{ images: dataUrl[] }`.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    const contentType = request.headers.get("content-type") || "";
    let append = true;
    let urls: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      append = form.get("append") !== "false";
      const entries = [...form.getAll("files"), ...form.getAll("file")];
      const blobs: { blob: Blob; name: string }[] = [];
      for (const entry of entries) {
        if (entry instanceof Blob && entry.size > 0) {
          const name =
            "name" in entry && typeof (entry as File).name === "string"
              ? (entry as File).name
              : "upload.jpg";
          blobs.push({ blob: entry, name });
        }
      }
      if (blobs.length === 0) {
        return NextResponse.json(
          { error: "No image files uploaded. Use field name “files”." },
          { status: 400, ...NO_STORE }
        );
      }
      for (const { blob, name } of blobs.slice(0, MAX_FILES)) {
        const dataUrl = await blobToDataUrl(blob, name);
        const match = DATA_URL_RE.exec(dataUrl);
        const ct = match?.[1] || "image/jpeg";
        urls.push(
          await persistDataUrlMedia(
            dataUrl,
            `garden-${garden.id}-map-ref-${Date.now()}-${urls.length}.${extFor(ct)}`
          )
        );
      }
    } else {
      let body: { images?: string[]; urls?: string[]; append?: boolean };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return NextResponse.json(
          {
            error:
              "Expected JSON { urls } (after signed upload), { images: dataUrl[] }, or multipart files.",
          },
          { status: 400, ...NO_STORE }
        );
      }
      append = body.append !== false;

      if (Array.isArray(body.urls) && body.urls.length > 0) {
        for (const raw of body.urls.slice(0, MAX_FILES)) {
          if (typeof raw !== "string" || !isAllowedPublicUrl(raw)) {
            return NextResponse.json(
              { error: "Each url must be an https image URL (from prepare upload)." },
              { status: 400, ...NO_STORE }
            );
          }
          urls.push(raw);
        }
      } else {
        const images = Array.isArray(body.images) ? body.images : [];
        for (const raw of images.slice(0, MAX_FILES)) {
          if (typeof raw !== "string" || !DATA_URL_RE.test(raw)) {
            return NextResponse.json(
              { error: "Each image must be a data:image/…;base64,… URI." },
              { status: 400, ...NO_STORE }
            );
          }
          const match = DATA_URL_RE.exec(raw)!;
          const bytes = Buffer.from(match[2], "base64");
          if (bytes.length > MAX_BYTES) {
            return NextResponse.json(
              {
                error:
                  "One image exceeds 20MB. Use the signed upload flow (prepare) for large files.",
              },
              { status: 400, ...NO_STORE }
            );
          }
          const ct = match[1] || "image/jpeg";
          urls.push(
            await persistDataUrlMedia(
              raw,
              `garden-${garden.id}-map-ref-${Date.now()}-${urls.length}.${extFor(ct)}`
            )
          );
        }
      }

      if (urls.length === 0) {
        return NextResponse.json({ error: "No images provided." }, { status: 400, ...NO_STORE });
      }
    }

    const existing = garden.brandKit.mapPlate.referenceUrls;
    const room = Math.max(0, MAX_FILES - (append ? existing.length : 0));
    if (room === 0 && append) {
      return NextResponse.json(
        { error: `Already at ${MAX_FILES} references. Remove one first.` },
        { status: 400, ...NO_STORE }
      );
    }

    const toAdd = urls.slice(0, append ? room : MAX_FILES);
    const referenceUrls = append
      ? [...existing, ...toAdd].slice(0, MAX_FILES)
      : toAdd.slice(0, MAX_FILES);

    const updated = await updateGarden(garden.id, {
      brandKit: {
        mapPlate: {
          ...garden.brandKit.mapPlate,
          referenceUrls,
        },
      },
    });

    return NextResponse.json({ urls: toAdd, referenceUrls, garden: updated }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
