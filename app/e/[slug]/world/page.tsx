import { Suspense } from "react";
import WorldLoadingShell from "@/components/song-garden-v2/WorldLoadingShell";
import WorldPageClient from "./WorldPageClient";

/**
 * Song Garden V2 participant entry point. Separate from the production
 * `/e/[slug]` route on purpose — see docs/song-garden-v2/architecture.md §4.
 */
export default function WorldPage() {
  return (
    <Suspense fallback={<WorldLoadingShell />}>
      <WorldPageClient />
    </Suspense>
  );
}
