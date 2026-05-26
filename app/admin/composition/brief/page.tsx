import { Suspense } from "react";
import CompositionBriefView from "./CompositionBriefView";

export default function CompositionBriefPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c0c0e] text-gray-500">
          Loading…
        </div>
      }
    >
      <CompositionBriefView />
    </Suspense>
  );
}
