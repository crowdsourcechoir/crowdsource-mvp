import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import PitchPasswordGate from "@/components/pitch/PitchPasswordGate";
import PitchSlideshow from "@/components/pitch/PitchSlideshow";
import PitchUnavailable from "@/components/pitch/PitchUnavailable";
import SpaceTextPage from "@/components/spaces/SpaceTextPage";
import { signedInOwner } from "@/lib/operators/current";
import { accountGateCookie } from "@/lib/spaces/gate";
import { readSpacePage, type SpacePage } from "@/lib/spaces/service";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

type PageProps = { params: { slug: string[] } };

function gated(page: SpacePage): page is Exclude<SpacePage, { kind: "none" } | { kind: "redirect" }> {
  return page.kind === "index" || page.kind === "document";
}

async function passwordOpen(page: Exclude<SpacePage, { kind: "none" } | { kind: "redirect" }>): Promise<boolean> {
  if (await signedInOwner()) return true;
  if (!page.passwordHash) return true;
  const cookie = accountGateCookie({
    organizationId: page.organizationId,
    slug: page.slug,
    passwordHash: page.passwordHash,
  });
  const token = (await cookies()).get(cookie.name)?.value;
  return token === cookie.value;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await readSpacePage(params.slug ?? []);
  const title = gated(page) ? page.title : "Crowdsource Choir";
  const description = page.kind === "document" ? page.description : undefined;
  return { title, description, robots: { index: false, follow: false } };
}

export default async function ClientSpacePage({ params }: PageProps) {
  const page = await readSpacePage(params.slug ?? []);
  if (page.kind === "none") notFound();
  if (page.kind === "redirect") redirect(page.href);
  if (!(await passwordOpen(page))) {
    return <PitchPasswordGate title={page.title} accessPath={`/api/for/${page.slug}/access`} />;
  }

  const owner = await signedInOwner();
  if (page.kind === "index") {
    if (page.items.length === 0) return <PitchUnavailable title={page.title} />;
    return <SpaceTextPage title={page.title} items={page.items} />;
  }
  if (!page.shareable && !owner) return <PitchUnavailable title={page.title} />;

  const slides = page.slides && (page.role === "deck" || page.role === "show" || page.role === "proposal") ? page.slides : null;
  if (slides && slides.length > 0) {
    return (
      <>
        {page.linkUrl ? (
          <a
            href={page.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="fixed right-4 top-4 z-50 rounded-full border border-[#CFFF81] bg-black/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#CFFF81] hover:bg-[#CFFF81] hover:text-black"
          >
            {page.linkLabel || "Open"}
          </a>
        ) : null}
        <PitchSlideshow slides={slides} displayClass={display.className} monoClass={mono.className} />
      </>
    );
  }
  return <SpaceTextPage title={page.title} body={page.body} linkUrl={page.linkUrl} linkLabel={page.linkLabel} />;
}
