import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getGardenByIdOrSlug } from "@/lib/song-garden-v2/garden/store";
import GardenPresenceClient from "./GardenPresenceClient";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export default async function PublicGardenPage({ params }: PageProps) {
  const garden = await getGardenByIdOrSlug(params.slug);
  if (!garden || garden.status === "draft") notFound();

  return (
    <Suspense
      fallback={
        <p className="px-4 py-10 text-center text-sm text-white/50">Loading garden…</p>
      }
    >
      <GardenPresenceClient gardenSlug={garden.slug} gardenTitle={garden.title} />
    </Suspense>
  );
}
