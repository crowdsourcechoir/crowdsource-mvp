import type { Metadata } from "next";
import GardenLab from "@/components/song-garden-lab/GardenLab";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import { getSettingsCard } from "@/lib/settings/catalog";

export const metadata: Metadata = {
  title: "Garden lab",
  robots: { index: false, follow: false },
};

export default function GardenLabSettingsPage() {
  const card = getSettingsCard("garden-lab");

  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={card?.title ?? "Garden lab"}
      description="The generative lab. The public journeys stay as they are."
    >
      <div className="h-[calc(100dvh-12rem)] min-h-[560px] overflow-hidden border border-white/10">
        <GardenLab embedded />
      </div>
    </SettingsSubpage>
  );
}
