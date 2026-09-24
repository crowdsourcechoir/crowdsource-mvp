import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import { slides } from "./content";
import PitchDeck from "./PitchDeck";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

export default function SobecaSongGardenPage() {
  return <PitchDeck slides={slides} displayClass={display.className} monoClass={mono.className} />;
}
