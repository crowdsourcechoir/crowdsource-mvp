import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Archivo_Black, Bebas_Neue, Space_Mono } from "next/font/google";
import PitchDeck from "./PitchDeck";
import PitchPasswordGate from "./PitchPasswordGate";
import { PITCH_AUTH_COOKIE, pitchAuthToken, readPitchPasswordHash } from "@/lib/sobeca-pitch/access";
import { resolveSongGardenPitch } from "@/lib/sobeca-pitch/copy";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const poster = Archivo_Black({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

export default async function SobecaSongGardenPage() {
  const passwordHash = await readPitchPasswordHash();
  if (passwordHash) {
    const token = (await cookies()).get(PITCH_AUTH_COOKIE)?.value;
    if (token !== pitchAuthToken(passwordHash)) {
      return <PitchPasswordGate />;
    }
  }
  const pitch = await resolveSongGardenPitch();
  return (
    <PitchDeck
      slides={pitch.slides}
      displayClass={display.className}
      posterClass={poster.className}
      monoClass={mono.className}
    />
  );
}
