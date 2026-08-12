import { redirect } from "next/navigation";
import { canonicalEventSlug } from "@/lib/event-slug-aliases";

type SonggardenPageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy Song Garden deep links redirect to the public World experience. */
export default async function SonggardenPage({ params }: SonggardenPageProps) {
  const { slug } = await params;
  redirect(`/e/${canonicalEventSlug(slug)}`);
}
