import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import PitchSlideshow from "@/components/pitch/PitchSlideshow";
import PitchPasswordGate from "@/components/pitch/PitchPasswordGate";
import PitchUnavailable from "@/components/pitch/PitchUnavailable";
import PitchDeck from "@/app/sobeca-song-garden/PitchDeck";
import { pitchGateCookie } from "@/lib/pitches/gate";
import { pitchDescription, SOBECA_PITCH_ID } from "@/lib/pitches/model";
import { loadPitch } from "@/lib/pitches/service";
import { pitchVisitorView } from "@/lib/pitches/visitor";
import { signedInOwner } from "@/lib/operators/current";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

type PageProps = { params: { slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pitch = await loadPitch(params.slug);
  if (!pitch) {
    return { title: "Pitch", robots: { index: false, follow: false } };
  }
  return {
    title: pitch.title,
    description: pitchDescription(pitch.slides, pitch.prompt),
    robots: { index: false, follow: false },
  };
}

export default async function PitchPage({ params }: PageProps) {
  if (!/^[a-z0-9-]{1,60}$/.test(params.slug)) notFound();
  const pitch = await loadPitch(params.slug);
  if (!pitch) notFound();
  if (pitch.href !== `/pitch/${params.slug}`) redirect(pitch.href);

  const owner = await signedInOwner();
  let unlocked = false;
  if (pitch.passwordHash) {
    const cookie = pitchGateCookie({ id: pitch.id, href: pitch.href, passwordHash: pitch.passwordHash });
    unlocked = (await cookies()).get(cookie.name)?.value === cookie.value;
  }
  const view = pitchVisitorView({
    live: pitch.live,
    hasPassword: Boolean(pitch.passwordHash),
    owner,
    unlocked,
  });
  if (view === "password") return <PitchPasswordGate title={pitch.title} pitchId={pitch.id} />;
  if (view === "unavailable") return <PitchUnavailable title={pitch.title} />;

  if (pitch.id === SOBECA_PITCH_ID) {
    return <PitchDeck slides={pitch.slides} displayClass={display.className} monoClass={mono.className} />;
  }
  return <PitchSlideshow slides={pitch.slides} displayClass={display.className} monoClass={mono.className} />;
}
