"use client";

import SonggardenCanvas from "@/components/songgarden/SonggardenCanvas";

/**
 * Composer landing = Master library (all sounds).
 * Bloom/garden Song Gardens stay on their own routes — not listed here.
 */
export default function ComposerPage() {
  return (
    <div className="w-full text-white">
      <SonggardenCanvas initialScope="master" />
    </div>
  );
}
