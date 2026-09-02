import SalesOverviewClient from "@/components/sales/SalesOverviewClient";
import DigestClient from "@/components/sales/DigestClient";
import GmailConnectClient from "@/components/sales/GmailConnectClient";
import EnrichmentConfigClient from "@/components/sales/EnrichmentConfigClient";
import { AddOrganizationLauncher } from "@/components/sales/AddOrganizationForm";

export default function SalesOverviewPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Sales</h1>
      <p className="mb-6 text-sm text-gray-400">AI-assisted prospecting — discover, research, score, and prepare outreach for human approval.</p>
      <EnrichmentConfigClient />
      <GmailConnectClient />
      <div className="mb-6 flex justify-end">
        <AddOrganizationLauncher />
      </div>
      <SalesOverviewClient />
      <div className="mt-6">
        <DigestClient />
      </div>
    </div>
  );
}
