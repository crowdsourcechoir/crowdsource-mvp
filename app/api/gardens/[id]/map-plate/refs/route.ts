import { NextResponse } from "next/server";
import { getGardenByIdOrSlug, updateGarden } from "@/lib/song-garden-v2/garden/store";
import { persistDataUrlMedia } from "@/lib/song-garden-v2/persist-generated-media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const MAX_FILES = 8;
const MAX_BYTES = 4.5 * 1024 * 1024;

type Ctx = { params: { id: string } };

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;

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
  // Some browsers/OS leave type empty — fall back to extension.
  if (!blob.type && IMAGE_EXT_RE.test(name)) return true;
  return false;
}

async function blobToDataUrl(blob: Blob, name = ""): Promise<string> {
  if (blob.size > MAX_BYTES) {
    throw new Error(`“${name || "Image"}” is too large (max ~4.5MB). Try a smaller JPEG.`);
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
 * Upload one or more map-plate reference photos.
 * Accepts multipart FormData (`files` / `file`) or JSON `{ images: dataUrl[] }`.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const garden = await getGardenByIdOrSlug(context.params.id);
    if (!garden) {
      return NextResponse.json({ error: "Not found" }, { status: 404, ...NO_STORE });
    }

    const contentType = request.headers.get("content-type") || "";
    const dataUrls: string[] = [];
    let append = true;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      append = form.get("append") !== "false";
      const entries = [
        ...form.getAll("files"),
        ...form.getAll("file"),
      ];
      const blobs: { blob: Blob; name: string }[] = [];
      for (const entry of entries) {
        // Next/Node may give Blob instead of File — accept both.
        if (entry instanceof Blob && entry.size > 0) {
          const name = "name" in entry && typeof (entry as File).name === "string"
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
        dataUrls.push(await blobToDataUrl(blob, name));
      }
    } else {
      let body: { images?: string[]; append?: boolean };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return NextResponse.json(
          { error: "Expected multipart files or JSON { images: dataUrl[] }." },
          { status: 400, ...NO_STORE }
        );
      }
      append = body.append !== false;
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
            { error: "One image exceeds ~4.5MB. Compress and retry." },
            { status: 400, ...NO_STORE }
          );
        }
        dataUrls.push(raw);
      }
      if (dataUrls.length === 0) {
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

    const toPersist = dataUrls.slice(0, append ? room : MAX_FILES);
    const urls: string[] = [];
    for (let i = 0; i < toPersist.length; i += 1) {
      const dataUrl = toPersist[i];
      const match = DATA_URL_RE.exec(dataUrl);
      const ct = match?.[1] || "image/jpeg";
      const url = await persistDataUrlMedia(
        dataUrl,
        `garden-${garden.id}-map-ref-${Date.now()}-${i}.${extFor(ct)}`
      );
      urls.push(url);
    }

    const referenceUrls = append
      ? [...existing, ...urls].slice(0, MAX_FILES)
      : urls.slice(0, MAX_FILES);

    const updated = await updateGarden(garden.id, {
      brandKit: {
        mapPlate: {
          ...garden.brandKit.mapPlate,
          referenceUrls,
        },
      },
    });

    return NextResponse.json({ urls, referenceUrls, garden: updated }, NO_STORE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500, ...NO_STORE });
  }
}
