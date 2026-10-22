import SettingsSubpage from "@/components/settings/SettingsSubpage";
import SongGardenPitchEditor from "@/components/settings/SongGardenPitchEditor";
import { getSettingsCard } from "@/lib/settings/catalog";

export default function SongGardenPitchSettingsPage() {
  const card = getSettingsCard("song-garden-pitch");

  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={card?.title ?? "Song Garden pitch"}
      description={card?.description ?? "Edit the public SoBECA Song Garden page. Saving updates the live page."}
    >
      <SongGardenPitchEditor />
    </SettingsSubpage>
  );
}
