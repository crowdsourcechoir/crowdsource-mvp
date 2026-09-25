"use client";

import { useEffect, useState } from "react";
import { FieldLabel, SettingsButton, TextField } from "@/components/settings/ui";

type LibraryAsset = {
  id: string;
  publicUrl: string;
  alt: string;
};

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
    return size;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EmailImageField({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (next: { imageUrl: string; assetId: string | null; alt?: string }) => void;
}) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketing/assets", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAssets(Array.isArray(data.assets) ? data.assets : []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await fetch("/api/marketing/assets/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, byteSize: file.size }),
      });
      const slot = await prepared.json();
      if (!prepared.ok) throw new Error(slot.error ?? "Could not start upload");
      const put = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      const size = await readImageSize(file);
      const confirmed = await fetch("/api/marketing/assets/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: slot.path,
          contentType: file.type,
          byteSize: file.size,
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
          width: size?.width ?? null,
          height: size?.height ?? null,
        }),
      });
      const saved = await confirmed.json();
      if (!confirmed.ok) throw new Error(saved.error ?? "Could not save image");
      const asset = saved.asset as LibraryAsset;
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setOpen(true);
      onChange({ imageUrl: asset.publicUrl, assetId: asset.id, alt: asset.alt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <FieldLabel>Image</FieldLabel>
      <TextField
        value={imageUrl}
        onChange={(value) => onChange({ imageUrl: value, assetId: null })}
        placeholder="https:// or choose from the library"
      />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <span className="inline-flex items-center justify-center rounded-full border border-[var(--csc-accent)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--csc-accent)]">
            {busy ? "Uploading" : "Upload"}
          </span>
        </label>
        <SettingsButton onClick={() => setOpen((value) => !value)}>{open ? "Hide library" : "Library"}</SettingsButton>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {imageUrl ? (
        <img src={imageUrl} alt="" className="mt-2 max-h-40 w-full object-contain" />
      ) : null}
      {open ? (
        <div className="csc-list mt-2">
          {assets.length === 0 ? <p className="csc-list-row text-sm text-gray-400">No images yet.</p> : null}
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="csc-list-row w-full text-left"
              onClick={() => onChange({ imageUrl: asset.publicUrl, assetId: asset.id, alt: asset.alt })}
            >
              <span className="flex items-center gap-3">
                <img src={asset.publicUrl} alt="" className="h-12 w-12 object-cover" />
                <span className="truncate text-sm">{asset.alt || "Untitled image"}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
