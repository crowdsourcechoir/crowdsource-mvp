import { Suspense } from "react";
import EventPageLoadingShell from "@/components/EventPageLoadingShell";
import WorldPageClient from "./WorldPageClient";

/**
 * Song Garden V2 participant entry point. Separate from the production
 * `/e/[slug]` route on purpose — see docs/song-garden-v2/architecture.md §4.
 */
export default function WorldPage() {
  return (
    <Suspense fallback={<EventPageLoadingShell />}>
      <WorldPageClient />
    </Suspense>
  );
}
