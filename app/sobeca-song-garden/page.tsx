import type { Metadata } from "next";
import { Bebas_Neue, Space_Mono } from "next/font/google";
import PitchDeck from "./PitchDeck";
import { resolveSongGardenSlides } from "@/lib/sobeca-pitch/copy";

export const dynamic = "force-dynamic";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoBECA Song Garden",
  description: "A Living Participatory Arts Initiative",
  robots: { index: false, follow: false },
};

export default async function SobecaSongGardenPage() {
  const slides = await resolveSongGardenSlides();
  return <PitchDeck slides={slides} displayClass={display.className} monoClass={mono.className} />;
}
