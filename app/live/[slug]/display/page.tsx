"use client";

import { useState, useEffect } from "react";
import { joinUrl } from "@/data/livePromptGame";
import QRCodeDisplay from "@/components/QRCodeDisplay";

const QR_SIZE = 480;

export default function LiveDisplayPage({ params }: { params: { slug: string } }) {
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const [joinLink, setJoinLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && slug) {
      setJoinLink(joinUrl(slug));
    }
  }, [slug]);

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0c0e] text-white">
        <p>Invalid link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0e] px-4 py-8">
      {joinLink ? (
        <>
          <p className="mb-6 text-center text-lg font-medium text-gray-300">
            Scan to join
          </p>
          <QRCodeDisplay
            url={joinLink}
            size={QR_SIZE}
            highRes
            className="shrink-0"
          />
        </>
      ) : (
        <div className="h-[480px] w-[480px] animate-pulse rounded-lg bg-gray-800" />
      )}
    </div>
  );
}
