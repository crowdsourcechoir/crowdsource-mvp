import { redirect } from "next/navigation";

type SonggardenPageProps = {
  params: Promise<{ slug: string }>;
};

/** Deep links land on the unified event page — no separate reload shell. */
export default async function SonggardenPage({ params }: SonggardenPageProps) {
  const { slug } = await params;
  redirect(`/e/${slug}?panel=songgarden`);
}
