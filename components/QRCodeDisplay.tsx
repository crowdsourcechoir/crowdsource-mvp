"use client";

/* eslint-disable @next/next/no-img-element -- QR from canvas data URL */
import { useEffect, useRef, useState } from "react";
import type QRCodeStyling from "qr-code-styling";

const DISPLAY_SIZE = 80;
const PRINT_SIZE = 1000;
const PRINT_BORDER = 24;
const PRINT_BORDER_RADIUS = 24;

type QRCodeDisplayProps = {
  url: string;
  size?: number;
  className?: string;
  /** If set, show a "Download" link to export a print-ready PNG. */
  downloadFilename?: string;
};

export default function QRCodeDisplay({
  url,
  size = DISPLAY_SIZE,
  className = "",
  downloadFilename,
}: QRCodeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (typeof window === "undefined" || !container) return;

    let cancelled = false;

    const load = async () => {
      const { default: QRCodeStyling } = await import("qr-code-styling");

      const logoUrl =
        typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "";

      const options = {
        width: size,
        height: size,
        data: url,
        margin: 4,
        qrOptions: { errorCorrectionLevel: "H" as const },
        image: logoUrl,
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.4,
          margin: 6,
          crossOrigin: "anonymous" as const,
        },
        dotsOptions: { color: "#ffffff", type: "rounded" as const },
        backgroundOptions: { color: "#000000" },
        cornersSquareOptions: { type: "extra-rounded" as const, color: "#ffffff" },
        cornersDotOptions: { type: "dot" as const, color: "#ffffff" },
      };

      const qr = new QRCodeStyling(options);
      if (cancelled) return;
      qrRef.current = qr;
      container.innerHTML = "";
      qr.append(container);
      setReady(true);
    };

    load();
    return () => {
      cancelled = true;
      qrRef.current = null;
      container.innerHTML = "";
      setReady(false);
    };
  }, [url, size]);

  const handleDownload = async () => {
    if (!downloadFilename) return;
    try {
      const { default: QRCodeStyling } = await import("qr-code-styling");
      const logoUrl = `${window.location.origin}/logo.png`;

      const qr = new QRCodeStyling({
        width: PRINT_SIZE,
        height: PRINT_SIZE,
        data: url,
        margin: 4,
        qrOptions: { errorCorrectionLevel: "H" as const },
        image: logoUrl,
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.4,
          margin: 6,
          crossOrigin: "anonymous" as const,
        },
        dotsOptions: { color: "#ffffff", type: "rounded" as const },
        backgroundOptions: { color: "#000000" },
        cornersSquareOptions: { type: "extra-rounded" as const, color: "#ffffff" },
        cornersDotOptions: { type: "dot" as const, color: "#ffffff" },
      });

      const blob = await qr.getRawData("png");
      if (!blob) return;

      const img = await createImageBitmap(blob as Blob);
      const total = PRINT_SIZE + PRINT_BORDER * 2;
      const canvas = document.createElement("canvas");
      canvas.width = total;
      canvas.height = total;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      const r = PRINT_BORDER_RADIUS;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(total - r, 0);
      ctx.quadraticCurveTo(total, 0, total, r);
      ctx.lineTo(total, total - r);
      ctx.quadraticCurveTo(total, total, total - r, total);
      ctx.lineTo(r, total);
      ctx.quadraticCurveTo(0, total, 0, total - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.drawImage(img, PRINT_BORDER, PRINT_BORDER, PRINT_SIZE, PRINT_SIZE);
      canvas.toBlob(
        (b) => {
          if (!b) return;
          const u = URL.createObjectURL(b);
          const a = document.createElement("a");
          a.href = u;
          a.download = downloadFilename;
          a.click();
          URL.revokeObjectURL(u);
        },
        "image/png",
        1
      );
    } catch (e) {
      console.warn("QR download failed:", e);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded-lg border-2 border-white shadow"
        style={{ width: size + 4, height: size + 4, padding: 2, background: "#000" }}
      >
        {!ready && (
          <div
            className="absolute inset-0 m-0.5 animate-pulse rounded bg-gray-800"
            style={{ margin: 2 }}
          />
        )}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded"
          style={{ width: size, height: size }}
          aria-hidden
        />
      </div>
      {downloadFilename && (
        <button
          type="button"
          onClick={handleDownload}
          className="text-xs font-medium text-gray-500 hover:text-gray-300 underline"
        >
          Download QR (print-ready)
        </button>
      )}
    </div>
  );
}
