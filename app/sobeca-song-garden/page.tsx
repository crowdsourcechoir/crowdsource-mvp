import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import PitchDeck from "./PitchDeck";
import { resolveSongGardenPitch } from "@/lib/sobeca-pitch/copy";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

export default async function SobecaSongGardenPage() {
  const pitch = await resolveSongGardenPitch();
  return (
    <PitchDeck
      slides={pitch.slides}
      copyColor={pitch.copyColor}
      displayClass={display.className}
      monoClass={mono.className}
    />
  );
}
