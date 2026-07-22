import { redirect } from "next/navigation";

type WorldPageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy /world URLs redirect to the public event page (now World). */
export default async function WorldPage({ params }: WorldPageProps) {
  const { slug } = await params;
  redirect(`/e/${slug}`);
}
