import OrganizationDetailClient from "@/components/sales/OrganizationDetailClient";

export default async function SalesOrganizationDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <OrganizationDetailClient orgId={orgId} />;
}
