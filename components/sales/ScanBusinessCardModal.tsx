"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SALES_INITIATIVES, type SalesInitiativeKey } from "@/lib/sales/initiatives";
import type { BusinessCardExtract } from "@/lib/sales/card-scan/schema";
import { apiErrorFromBody, publicErrorMessage, readApiJson } from "@/lib/sales/http-error";

const INITIATIVE_KEYS = Object.keys(SALES_INITIATIVES) as SalesInitiativeKey[];

type Phase = "capture" | "reading" | "review" | "saving";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (result: { queueItemId: string | null; opportunityId: string; message: string }) => void;
};

function emptyForm(): BusinessCardExtract & { eventName: string; salesInitiative: SalesInitiativeKey | "" } {
  return {
    fullName: null,
    roleTitle: null,
    organizationName: null,
    email: null,
    phone: null,
    websiteUrl: null,
    linkedinUrl: null,
    notes: null,
    confidence: 0,
    eventName: "",
    salesInitiative: "conferences_associations",
  };
}

async function fileToCompressedDataUrl(file: Blob, maxEdge = 1600, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function ScanCardButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scan business card"
      title="Scan business card"
      className={`csc-btn-circle inline-flex h-9 w-9 shrink-0 items-center justify-center border border-gray-800 text-gray-300 hover:border-[var(--csc-accent)] hover:text-white ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="8.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <path d="M12 10.5h6M12 13.5h4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default function ScanBusinessCardModal({ open, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setStreamReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    setPhase("capture");
    setPreviewUrl(null);
    setForm(emptyForm());
    setError(null);
    setCameraError(null);
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "reading" && phase !== "saving") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose, reset]);

  useEffect(() => {
    if (!open || phase !== "capture") return;
    let cancelled = false;
    (async () => {
      setCameraError(null);
      try {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          throw new Error("Camera needs HTTPS — use Choose photo instead.");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not available — use Choose photo.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStreamReady(true);
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "Camera unavailable — use Choose photo.");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, phase, stopCamera]);

  async function runExtract(dataUrl: string) {
    setPhase("reading");
    setError(null);
    setPreviewUrl(dataUrl);
    stopCamera();
    try {
      const res = await fetch("/api/sales/contacts/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not read the card"));
      const body = data as { extract?: BusinessCardExtract };
      const extract = body.extract ?? emptyForm();
      setForm((prev) => ({
        ...prev,
        ...extract,
        eventName: prev.eventName,
        salesInitiative: prev.salesInitiative || "conferences_associations",
      }));
      setPhase("review");
    } catch (err) {
      setError(publicErrorMessage(err, "Could not read the card"));
      setPhase("capture");
    }
  }

  async function snapFromCamera() {
    const video = videoRef.current;
    if (!video || !streamReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    await runExtract(dataUrl);
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await runExtract(dataUrl);
    } catch (err) {
      setError(publicErrorMessage(err, "Could not open that photo"));
    }
  }

  function setField<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value.trim() === "" ? (key === "salesInitiative" || key === "eventName" ? value : null) : value }));
  }

  async function save() {
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/sales/contacts/from-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          roleTitle: form.roleTitle,
          organizationName: form.organizationName,
          email: form.email,
          phone: form.phone,
          websiteUrl: form.websiteUrl,
          linkedinUrl: form.linkedinUrl,
          notes: form.notes,
          confidence: form.confidence,
          salesInitiative: form.salesInitiative || null,
          eventName: form.eventName.trim() || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(apiErrorFromBody(data, "Could not save"));
      const body = data as {
        queueItemId?: string | null;
        opportunityId?: string;
        message?: string;
      };
      onSaved?.({
        queueItemId: body.queueItemId ?? null,
        opportunityId: body.opportunityId ?? "",
        message: body.message ?? "Saved to Interest.",
      });
      onClose();
      reset();
    } catch (err) {
      setError(publicErrorMessage(err, "Could not save"));
      setPhase("review");
    }
  }

  if (!open) return null;

  const busy = phase === "reading" || phase === "saving";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-card-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-700 bg-black sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div>
            <p className="csc-eyebrow">Conference floor</p>
            <h2 id="scan-card-title" className="mt-1 text-lg font-semibold text-white">
              Scan business card
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Lands in Interest by default. Queue when email is deliverable.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {phase === "capture" || phase === "reading" ? (
            <div className="space-y-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
                {previewUrl && phase === "reading" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Card preview" className="h-full w-full object-contain" />
                ) : (
                  <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                )}
                {phase === "reading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
                    Reading card…
                  </div>
                ) : null}
              </div>
              {cameraError ? <p className="text-xs text-amber-400">{cameraError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !streamReady}
                  onClick={() => void snapFromCamera()}
                  className="rounded-lg bg-[var(--csc-accent)] px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
                >
                  Snap card
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-gray-600 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50"
                >
                  Choose photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Scanned card"
                  className="mx-auto max-h-28 rounded-lg border border-gray-800 object-contain"
                />
              ) : null}
              <p className="text-xs text-gray-500">
                Confidence {Math.round((form.confidence || 0) * 100)}% · edit anything before saving
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["fullName", "Full name"],
                    ["organizationName", "Organization"],
                    ["roleTitle", "Title / role"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["websiteUrl", "Website"],
                    ["linkedinUrl", "LinkedIn"],
                    ["eventName", "Event (optional)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs text-gray-500">
                    {label}
                    <input
                      value={(form[key] as string | null) ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={busy}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600"
                    />
                  </label>
                ))}
                <label className="block text-xs text-gray-500 sm:col-span-2">
                  Notes
                  <input
                    value={form.notes ?? ""}
                    onChange={(e) => setField("notes", e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-gray-500 sm:col-span-2">
                  Category
                  <select
                    value={form.salesInitiative}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        salesInitiative: (e.target.value || "") as SalesInitiativeKey | "",
                      }))
                    }
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                  >
                    {INITIATIVE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {SALES_INITIATIVES[key].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPreviewUrl(null);
                    setPhase("capture");
                  }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50"
                >
                  Retake
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="rounded-lg bg-[var(--csc-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  {phase === "saving" ? "Saving…" : "Save to Interest"}
                </button>
              </div>
            </div>
          )}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
