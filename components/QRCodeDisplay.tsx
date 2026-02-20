"use client";

/* eslint-disable @next/next/no-img-element -- QR data URL from canvas, not a static asset */
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QRCodeDisplayProps = {
  url: string;
  size?: number;
  className?: string;
  /** If set, show a "Download" link to export the QR as a PNG. */
  downloadFilename?: string;
};

export default function QRCodeDisplay({ url, size = 80, className = "", downloadFilename }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setDataUrl(null);
    let cancelled = false;
    QRCode.toDataURL(url, { width: size, margin: 1 }).then((data) => {
      if (!cancelled) setDataUrl(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) return <div className={`aspect-square bg-gray-100 rounded ${className}`} style={{ width: size, height: size }} />;
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={dataUrl}
        alt="QR code"
        className={`rounded border border-gray-200 ${className}`}
        width={size}
        height={size}
      />
      {downloadFilename && (
        <a
          href={dataUrl}
          download={downloadFilename}
          className="text-xs font-medium text-gray-500 hover:text-gray-300 underline"
        >
          Download QR
        </a>
      )}
    </div>
  );
}
