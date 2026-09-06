"use client";

import Link from "next/link";
import DesignSystemControls from "@/components/settings/DesignSystemControls";

export default function DesignSystemSettingsPage() {
  return (
    <div className="w-full space-y-6 text-white">
      <div>
        <Link href="/admin/settings" className="csc-link text-sm font-medium">
          ← Settings
        </Link>
        <p className="csc-eyebrow mt-4">Workspace</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Design system</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Edit the shared chrome tokens. Changes apply live across admin and persist in this browser.
        </p>
      </div>

      <DesignSystemControls />
    </div>
  );
}
