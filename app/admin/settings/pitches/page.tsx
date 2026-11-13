import PitchesLibrary from "@/components/settings/PitchesLibrary";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function PitchesSettingsPage() {
  const card = getSettingsCard("pitches");

  return (
    <PitchesLibrary title={card?.title ?? "Pitches"} />
  );
}
