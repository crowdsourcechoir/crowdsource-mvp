import { redirect } from "next/navigation";

type SonggardenPageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy Song Garden deep links redirect to the public World experience. */
export default async function SonggardenPage({ params }: SonggardenPageProps) {
  const { slug } = await params;
  redirect(`/e/${slug}`);
}
