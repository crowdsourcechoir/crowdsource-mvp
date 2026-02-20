"use client";

/* eslint-disable @next/next/no-img-element -- QR data URL from canvas, not a static asset */
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QRCodeDisplayProps = {
  url: string;
  size?: number;
  className?: string;
};

export default function QRCodeDisplay({ url, size = 80, className = "" }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: size, margin: 1 }).then(setDataUrl);
  }, [url, size]);

  if (!dataUrl) return <div className={`aspect-square bg-gray-100 rounded ${className}`} style={{ width: size, height: size }} />;
  return (
    <img
      src={dataUrl}
      alt="QR code"
      className={`rounded border border-gray-200 ${className}`}
      width={size}
      height={size}
    />
  );
}
