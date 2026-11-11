import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ShowPresent from "@/components/show/ShowPresent";
import { resolveShowBackground } from "@/lib/show-slides/background";
import { loadShow } from "@/lib/show-slides/service";
import { signedInOwner } from "@/lib/operators/current";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const show = await loadShow(params.slug);
  return {
    title: show ? show.name : "Show",
    robots: { index: false, follow: false },
  };
}

export default async function ShowPage({ params }: PageProps) {
  if (!/^[a-z0-9-]{1,60}$/.test(params.slug)) notFound();
  if (!(await signedInOwner())) redirect("/");
  const show = await loadShow(params.slug);
  if (!show) notFound();
  const background = await resolveShowBackground(show);
  const bloomIds = Array.from(
    new Set(show.slides.map((slide) => slide.bloomId).filter((id): id is string => Boolean(id)))
  ).filter((id) => id !== show.bloomId);
  const pairs = await Promise.all(
    bloomIds.map(async (id) => {
      const resolved = await resolveShowBackground({ ...show, bloomId: id, match: null });
      return [id, resolved] as const;
    })
  );
  return <ShowPresent show={show} background={background} bloomBackgrounds={Object.fromEntries(pairs)} />;
}
