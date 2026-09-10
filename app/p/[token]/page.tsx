import PitchPublicClient from "@/components/sales/PitchPublicClient";

export default async function PublicPitchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PitchPublicClient token={token} />;
}
