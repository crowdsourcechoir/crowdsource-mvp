import FollowUpsClient from "@/components/sales/FollowUpsClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesFollowUpsPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Follow-ups</h1>
      <p className="mb-4 text-sm text-gray-400">
        Day-7 and day-14 nudges. Queue stays first-touch only. Nothing sends until you click Send → Yes, send now.
      </p>
      <SalesSubNav />
      <FollowUpsClient />
    </div>
  );
}
