import { notFound } from "next/navigation";
import SettingsSubpage from "@/components/settings/SettingsSubpage";
import PitchEditor from "@/components/settings/PitchEditor";
import { SOBECA_PITCH_ID } from "@/lib/pitches/model";
import { loadPitch } from "@/lib/pitches/service";

export const dynamic = "force-dynamic";

export default async function PitchSettingsPage({ params }: { params: { id: string } }) {
  if (!/^[a-z0-9_-]{1,80}$/.test(params.id)) notFound();
  const pitch = await loadPitch(params.id);
  if (!pitch || pitch.id !== params.id) notFound();
  const sobeca = pitch.id === SOBECA_PITCH_ID;

  return (
    <SettingsSubpage
      eyebrow="Workspace"
      title={sobeca ? "Song Garden pitch" : pitch.name}
      description={sobeca ? "Words on the public SoBECA page" : "Words on the live page."}
      backHref="/admin/settings/pitches"
      backLabel="← Pitches"
    >
      <PitchEditor id={pitch.id} />
    </SettingsSubpage>
  );
}
