import { redirect } from "next/navigation";
import { canonicalEventSlug } from "@/lib/event-slug-aliases";

type WorldPageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy /world URLs redirect to the public event page (now World). */
export default async function WorldPage({ params }: WorldPageProps) {
  const { slug } = await params;
  redirect(`/e/${canonicalEventSlug(slug)}`);
}
