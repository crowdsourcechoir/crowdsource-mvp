import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import PitchDeck from "./PitchDeck";
import PitchPasswordGate from "./PitchPasswordGate";
import { PITCH_AUTH_COOKIE, pitchAuthToken, readPitchPasswordHash } from "@/lib/sobeca-pitch/access";
import { resolveSongGardenPitch } from "@/lib/sobeca-pitch/copy";
import PitchUnavailable from "@/components/pitch/PitchUnavailable";
import { loadPitch } from "@/lib/pitches/service";
import { pitchVisitorView } from "@/lib/pitches/visitor";
import { signedInOwner } from "@/lib/operators/current";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

export default async function SobecaSongGardenPage() {
  const listing = await loadPitch("sobeca-song-garden");
  if (listing && listing.href !== "/sobeca-song-garden") redirect(listing.href);
  const live = listing?.live !== false;
  const passwordHash = await readPitchPasswordHash();
  const unlocked = passwordHash
    ? (await cookies()).get(PITCH_AUTH_COOKIE)?.value === pitchAuthToken(passwordHash)
    : false;
  const owner = !live && !unlocked ? await signedInOwner() : false;
  const view = pitchVisitorView({
    live,
    hasPassword: Boolean(passwordHash),
    owner,
    unlocked,
  });
  if (view === "password") return <PitchPasswordGate />;
  if (view === "unavailable") return <PitchUnavailable title="SoBECA Song Garden" />;
  const pitch = await resolveSongGardenPitch();
  return <PitchDeck slides={pitch.slides} displayClass={display.className} monoClass={mono.className} />;
}
