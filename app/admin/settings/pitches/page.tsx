import SettingsSubpage from "@/components/settings/SettingsSubpage";
import PitchesLibrary from "@/components/settings/PitchesLibrary";
import { getSettingsCard } from "@/lib/settings/catalog";

export const dynamic = "force-dynamic";

export default function PitchesSettingsPage() {
  const card = getSettingsCard("pitches");

  return (
    <SettingsSubpage
      eyebrow="Content"
      title={card?.title ?? "Pitches"}
      description="Find a pitch, duplicate one, or create a new one from a prompt. Each pitch is a live page, and asks for a password when you set one."
    >
      <PitchesLibrary />
    </SettingsSubpage>
  );
}
