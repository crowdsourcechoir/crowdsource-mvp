import BatchRunClient from "@/components/sales/BatchRunClient";
import DiscoveryRunClient from "@/components/sales/DiscoveryRunClient";
import OrganizationsClient from "@/components/sales/OrganizationsClient";
import SalesSubNav from "@/components/sales/SalesSubNav";

export default function SalesOrganizationsPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Organizations</h1>
      <SalesSubNav />
      <DiscoveryRunClient />
      <BatchRunClient />
      <OrganizationsClient />
    </div>
  );
}
