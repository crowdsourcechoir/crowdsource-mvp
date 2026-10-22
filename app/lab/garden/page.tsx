import type { Metadata } from "next";
import GardenLab from "@/components/song-garden-lab/GardenLab";

export const metadata: Metadata = {
  title: "Garden lab",
  robots: { index: false, follow: false },
};

export default function GrammarBenchPage() {
  return <GardenLab />;
}
