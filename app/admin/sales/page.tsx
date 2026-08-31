import SalesTodayClient from "@/components/sales/SalesTodayClient";
import DigestClient from "@/components/sales/DigestClient";
import GmailConnectClient from "@/components/sales/GmailConnectClient";
import EnrichmentConfigClient from "@/components/sales/EnrichmentConfigClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOverviewPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Today</h1>
      <p className="mb-4 text-sm text-gray-400">
        Replies first, then follow-ups, then new sends. Queue is unchanged — keep working sports contacts there.
      </p>
      <SalesSubNav />
      <SalesTodayClient />
      <div className="mt-10">
        <GmailConnectClient />
      </div>
      <div className="mt-6">
        <EnrichmentConfigClient />
      </div>
      <div className="mt-6">
        <DigestClient />
      </div>
    </div>
  );
}
