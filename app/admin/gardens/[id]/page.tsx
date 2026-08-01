import GardenDetailClient from "./GardenDetailClient";

export default function AdminGardenDetailPage({ params }: { params: { id: string } }) {
  return <GardenDetailClient gardenId={params.id} />;
}
