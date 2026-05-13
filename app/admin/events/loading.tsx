import AdminIndeterminateProgress from "@/components/AdminIndeterminateProgress";
import AdminEventsLoadingSkeleton from "@/components/AdminEventsLoadingSkeleton";

export default function AdminEventsLoading() {
  return (
    <>
      <AdminIndeterminateProgress />
      <div className="min-h-[50vh]">
        <div className="mb-6 sm:mb-8">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-800" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-gray-800/70" />
          <div className="mt-5 flex gap-3">
            <div className="h-11 w-40 animate-pulse rounded-xl bg-gray-800" />
            <div className="h-12 w-36 animate-pulse rounded-xl bg-gray-800" />
          </div>
        </div>
        <AdminEventsLoadingSkeleton />
      </div>
    </>
  );
}
