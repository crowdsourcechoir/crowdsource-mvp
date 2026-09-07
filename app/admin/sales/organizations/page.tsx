import BatchRunClient from "@/components/sales/BatchRunClient";
import DiscoveryRunClient from "@/components/sales/DiscoveryRunClient";
import FillQueueClient from "@/components/sales/FillQueueClient";
import OrganizationsClient from "@/components/sales/OrganizationsClient";
import { AddOrganizationLauncher } from "@/components/sales/AddOrganizationForm";

export default function SalesOrganizationsPage() {
  return (
    <div className="w-full text-white">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="csc-eyebrow">Prospecting</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Organizations</h1>
        </div>
        <AddOrganizationLauncher />
      </div>
      <FillQueueClient />
      <DiscoveryRunClient />
      <BatchRunClient />
      <OrganizationsClient />
    </div>
  );
}
